# Copyright (c) 2026, Kenz and contributors
# Data for the admin dashboard. Only Admin and System Manager may call these.

import frappe

TASK_STATUSES = ("Open", "In Progress", "Pending", "Completed", "Cancelled")
DASHBOARD_ROLES = ("Admin", "System Manager")
MAX_PAGE_LENGTH = 100


def has_app_permission():
	"""Whether the JMS Dashboard tile is shown on the apps screen."""
	return bool(set(DASHBOARD_ROLES) & set(frappe.get_roles()))


def _admin_only():
	frappe.only_for(DASHBOARD_ROLES)


def _key(status):
	return status.lower().replace(" ", "_")


@frappe.whitelist()
def task_status_counts():
	"""Number of tasks per status, for the cards at the top of the dashboard."""
	_admin_only()
	counts = {status: 0 for status in TASK_STATUSES}
	for status, count in frappe.db.sql(
		"select status, count(*) from `tabJob Task` where parenttype = 'Job' group by status"
	):
		counts[status] = count
	return {"all": sum(counts.values()), **{_key(status): count for status, count in counts.items()}}


@frappe.whitelist()
def job_cards(status=None, search=None, start=0, page_length=20):
	"""One card per Job with its task counts. `status` keeps only Jobs that have
	at least one task in that status."""
	_admin_only()
	if status and status not in TASK_STATUSES:
		frappe.throw(f"Status must be one of: {', '.join(TASK_STATUSES)}")
	start = max(int(start or 0), 0)
	page_length = min(max(int(page_length or 20), 1), MAX_PAGE_LENGTH)

	conditions, values = [], {"start": start, "page_length": page_length}
	if search:
		conditions.append("(j.name like %(search)s or j.job_title like %(search)s or j.customer_name like %(search)s)")
		values["search"] = f"%{search}%"
	where = f"where {' and '.join(conditions)}" if conditions else ""

	having = ""
	if status:
		having = "having sum(t.status = %(status)s) > 0"
		values["status"] = status

	base = f"""
		from `tabJob` j
		left join `tabJob Task` t on t.parent = j.name and t.parenttype = 'Job'
		{where}
		group by j.name
		{having}
	"""
	total = frappe.db.sql(f"select count(*) from (select j.name {base}) x", values)[0][0]

	task_counts = ", ".join(
		f"coalesce(sum(t.status = '{s}'), 0) as `{_key(s)}`" for s in TASK_STATUSES
	)
	jobs = frappe.db.sql(
		f"""
		select j.name, j.job_title, j.customer, j.customer_name, j.status, j.priority,
			j.date, j.expected_completion_date, j.overdue_status,
			count(t.name) as task_total, {task_counts}
		{base}
		order by j.modified desc
		limit %(start)s, %(page_length)s
		""",
		values,
		as_dict=True,
	)
	for job in jobs:
		for s in TASK_STATUSES:
			job[_key(s)] = int(job[_key(s)])
	return {"jobs": jobs, "total": total}


@frappe.whitelist(methods=["POST"])
def update_task_status(task, status, pending_reason=None):
	"""Move one Job Task to another status (the dashboard's drag and drop). The
	Job is saved normally, so its rules (Pending Reason, closing) and the
	Updated Document log all apply."""
	_admin_only()
	if status not in TASK_STATUSES:
		frappe.throw(f"Status must be one of: {', '.join(TASK_STATUSES)}")

	parent = frappe.db.get_value("Job Task", {"name": task, "parenttype": "Job"}, "parent")
	if not parent:
		frappe.throw(f"Task {task} not found", frappe.DoesNotExistError)

	job = frappe.get_doc("Job", parent)
	row = next(t for t in job.tasks if t.name == task)
	if row.status == status:
		return {"status": status}

	reason = (pending_reason or "").strip()
	if status == "Pending" and not reason:
		frappe.throw("Please give a Pending Reason")

	previous = row.status
	row.status = status
	row.pending_reason = reason if status == "Pending" else None
	if status == "Completed":
		row.completion_date = row.completion_date or frappe.utils.nowdate()
	elif previous == "Completed":
		row.completion_date = None
	job.save()
	return {"status": status}


@frappe.whitelist()
def job_tasks(job):
	"""The tasks of one Job (with the Pending Reason of pending ones) and the
	latest changes made to it."""
	_admin_only()
	if not frappe.db.exists("Job", job):
		frappe.throw(f"Job {job} not found", frappe.DoesNotExistError)

	tasks = frappe.db.sql(
		"""
		select t.name, t.idx, t.task_name, t.employee__outsource, t.assigned_to,
			e.employee_name, t.assigned_tos, t.status, t.pending_reason, t.due_date,
			t.completion_date, t.priority
		from `tabJob Task` t
		left join `tabEmployee` e on e.name = t.assigned_to
		where t.parent = %s and t.parenttype = 'Job'
		order by t.idx
		""",
		job,
		as_dict=True,
	)
	history = frappe.get_all(
		"Updated Document",
		filters={"job": job},
		fields=[
			"updated_doctype", "updated_name", "field_changed", "old_value", "new_value",
			"reason", "updated_by", "creation",
		],
		order_by="creation desc",
		limit_page_length=50,
	)
	summary = frappe.db.get_value(
		"Job", job, ["name", "job_title", "customer_name", "status", "priority"], as_dict=True
	)
	return {"job": summary, "tasks": tasks, "history": _timeline(history, tasks)}


def _timeline(history, tasks):
	"""Turn Updated Document rows into readable timeline events: who, which task,
	which field (by label), from what to what, and the reason. A Pending Reason row
	saved together with its status change is folded into that status event."""
	task_by_idx = {t.idx: t.task_name for t in tasks}
	labels = {}
	names = {}

	def label(doctype, fieldname):
		key = (doctype, fieldname)
		if key not in labels:
			df = frappe.get_meta(doctype).get_field(fieldname)
			labels[key] = df.label if df and df.label else fieldname.replace("_", " ").title()
		return labels[key]

	def full_name(user):
		if user and user not in names:
			names[user] = frappe.utils.get_fullname(user)
		return names.get(user) or ""

	# Pending Reason rows saved together with a status change of the same task
	# are folded into that status event (the reason is shown on the event).
	reason_for, folded = {}, set()
	for i, row in enumerate(history):
		parts = [p.strip() for p in (row.field_changed or "").split("›")]
		if row.updated_doctype != "Job" or len(parts) != 3 or parts[2] != "status":
			continue
		for j, other in enumerate(history):
			if (
				j not in folded
				and other.updated_doctype == "Job"
				and other.field_changed == f"tasks › {parts[1]} › pending_reason"
				and abs((other.creation - row.creation).total_seconds()) < 5
			):
				folded.add(j)
				reason_for[i] = other.new_value or None

	events = []
	for i, row in enumerate(history):
		if i in folded:
			continue
		parts = [p.strip() for p in (row.field_changed or "").split("›")]
		event = frappe._dict(
			doctype=row.updated_doctype,
			docname=row.updated_name,
			actor=row.updated_by,
			actor_name=full_name(row.updated_by),
			when=row.creation,
			old=row.old_value,
			new=row.new_value,
			reason=row.reason or reason_for.get(i),
			task=None,
			kind="field",
			field=parts[-1],
			field_label=parts[-1],
		)
		if row.updated_doctype == "Job" and len(parts) == 3 and parts[0] == "tasks":
			idx = int(parts[1].replace("row", "").strip() or 0)
			event.task = task_by_idx.get(idx) or f"Task {idx}"
			event.field_label = label("Job Task", parts[2])
			if parts[2] == "status":
				event.kind = "status"
				if event.new != "Pending":
					event.reason = None
		elif len(parts) == 2 and parts[1] in ("row added", "row removed"):
			event.kind = "row_added" if parts[1] == "row added" else "row_removed"
			event.field_label = label(row.updated_doctype, parts[0])
			try:
				event.task = frappe.parse_json(row.new_value or row.old_value or "{}").get("task_name")
			except Exception:
				event.task = None
		elif len(parts) == 1:
			event.field_label = label(row.updated_doctype, parts[0])
			if parts[0] == "status":
				event.kind = "job_status"
		events.append(event)
	return events
