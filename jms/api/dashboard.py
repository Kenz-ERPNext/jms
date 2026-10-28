# Copyright (c) 2026, Kenz and contributors
# Data for the admin dashboard. Only Admin and System Manager may call these.

import frappe

from jms.api.timeline import _timeline

TASK_STATUSES = ("Open", "In Progress", "Pending", "Completed", "Cancelled")
DASHBOARD_ROLES = ("Admin", "System Manager")
MAX_PAGE_LENGTH = 100


def has_app_permission():
	"""Whether the SBM Dashboard tile is shown on the apps screen."""
	return bool(set(DASHBOARD_ROLES) & set(frappe.get_roles()))


def _admin_only():
	frappe.only_for(DASHBOARD_ROLES)


def _key(status):
	return status.lower().replace(" ", "_")


@frappe.whitelist()
def job_status_counts():
	"""Numbers for the cards at the top of the dashboard, counted in jobs so they
	match the job list: `all` is every Job, and each status is the number of Jobs
	with at least one task in that status (the same Jobs its filter shows). A Job
	can count under more than one status. `tasks` holds the matching task counts."""
	_admin_only()
	jobs = {status: 0 for status in TASK_STATUSES}
	tasks = {status: 0 for status in TASK_STATUSES}
	for status, job_count, task_count in frappe.db.sql(
		"""select status, count(distinct parent), count(*) from `tabJob Task`
		where parenttype = 'Job' group by status"""
	):
		if status in jobs:
			jobs[status] = job_count
			tasks[status] = task_count
	return {
		"all": frappe.db.count("Job"),
		**{_key(status): count for status, count in jobs.items()},
		# the number of tasks behind each card, shown as a second line
		"tasks": {
			"all": frappe.db.count("Job Task", {"parenttype": "Job"}),
			**{_key(status): count for status, count in tasks.items()},
		},
	}

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
