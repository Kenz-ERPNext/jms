# Copyright (c) 2026, Kenz and contributors
# Turns Updated Document rows into the Job timeline shown on the dashboard.

import frappe


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
