# Copyright (c) 2026, Kenz and contributors
# Doc-event handlers for documents linked to a Job.

import frappe


def _reopen_job_if_closed(job_name):
	"""A 'Closed' Job requires all tasks Completed AND the full amount received.
	Cancelling a linked Sales/Purchase Invoice or Payment breaks that basis, so
	revert the job from Closed back to Completed (tasks are still done) and clear
	its closing_date — keeping the Lifecycle stepper in sync with Work & Money."""
	if job_name and frappe.db.get_value("Job", job_name, "status") == "Closed":
		frappe.db.set_value(
			"Job", job_name,
			{"status": "Completed", "closing_date": None},
			update_modified=False,
		)


def on_sales_invoice_cancel(doc, method=None):
	"""When a Sales Invoice is cancelled, clear the Job's back-reference so the
	invoice can be deleted/amended and 'Create Sales Invoice' is available again,
	and reopen the job if it was Closed. Uses db.set_value to avoid re-triggering
	Job validation."""
	for job in frappe.get_all("Job", filters={"linked_invoice": doc.name}, pluck="name"):
		frappe.db.set_value(
			"Job", job,
			{"linked_invoice": None, "sales_invoice_status": "", "sales_invoice_payment_entry": None},
			update_modified=False,
		)
	_reopen_job_if_closed(doc.get("job"))


def on_purchase_invoice_cancel(doc, method=None):
	"""When a Purchase Invoice is cancelled, clear the Job's back-reference so it
	can be deleted/amended and re-created, and reopen the job if it was Closed.
	The outsource task rows that pointed at it are cleared too, so they no
	longer look billed."""
	for job in frappe.get_all("Job", filters={"purchase_invoice": doc.name}, pluck="name"):
		frappe.db.set_value(
			"Job", job,
			{"purchase_invoice": None, "purchase_invoice_status": ""},
			update_modified=False,
		)
	for row in frappe.get_all("Job Task", filters={"purchase_invoice": doc.name}, pluck="name"):
		frappe.db.set_value("Job Task", row, "purchase_invoice", None, update_modified=False)
	_reopen_job_if_closed(doc.get("job"))


def on_sales_invoice_submit(doc, method=None):
	"""A submitted Sales Invoice tagged to a Job (typically the amendment of a
	cancelled one) becomes that Job's linked invoice again, so the form stops
	offering 'Create Sales Invoice' / 'Creation is Pending' for a billed job."""
	if doc.get("job"):
		frappe.db.set_value(
			"Job", doc.job,
			{"linked_invoice": doc.name, "sales_invoice_status": "Created"},
			update_modified=False,
		)


def on_purchase_invoice_submit(doc, method=None):
	"""When a cancelled outsource Purchase Invoice is amended and re-submitted,
	move the Job Task rows (and the Job's back-reference) from the cancelled
	name to the new one. Expense Purchase Invoices are never referenced by a
	task row, so they are left alone."""
	if not (doc.get("job") and doc.get("amended_from")):
		return
	rows = frappe.get_all("Job Task", filters={"purchase_invoice": doc.amended_from, "parent": doc.job}, pluck="name")
	if not rows:
		return
	for row in rows:
		frappe.db.set_value("Job Task", row, "purchase_invoice", doc.name, update_modified=False)
	frappe.db.set_value(
		"Job", doc.job,
		{"purchase_invoice": doc.name, "purchase_invoice_status": "Created"},
		update_modified=False,
	)


def on_payment_entry_cancel(doc, method=None):
	"""Cancelling a payment removes received/paid amount, so a Closed job is no
	longer fully settled — reopen it. (Receivable/payable figures themselves are
	recomputed live by get_financials, which already excludes cancelled docs.)
	If it was the Job's tracked Sales Invoice payment, drop that reference."""
	for job in frappe.get_all("Job", filters={"sales_invoice_payment_entry": doc.name}, pluck="name"):
		frappe.db.set_value("Job", job, "sales_invoice_payment_entry", None, update_modified=False)
	_reopen_job_if_closed(doc.get("job"))


def log_cancelled_document(doc, method=None):
	"""Keep a copy of every record that gets cancelled in the Cancelled Document
	doctype (the cancel-side twin of Frappe's Deleted Document). Registered for
	all doctypes in hooks.py:

	- on_cancel: a submitted record (Sales Invoice, Payment Entry, ...) is cancelled.
	- on_update: a record whose status is set to "Cancelled" (Job, Task, ...).

	Logging must never stop the cancel itself, so any failure goes to the Error Log.
	"""
	if doc.doctype == "Cancelled Document" or frappe.flags.in_install:
		return

	if method == "on_update":
		# Submittable records are logged by on_cancel, not here.
		if doc.docstatus == 2 or not doc.meta.has_field("status"):
			return
		if doc.get("status") != "Cancelled" or not doc.has_value_changed("status"):
			return

	try:
		frappe.get_doc(
			{
				"doctype": "Cancelled Document",
				"cancelled_doctype": doc.doctype,
				"cancelled_name": doc.name,
				"cancelled_by": frappe.session.user,
				"job": doc.name if doc.doctype == "Job" else doc.get("job"),
				"data": doc.as_json(),
			}
		).insert(ignore_permissions=True)
	except Exception:
		frappe.log_error(
			title=f"Cancelled Document log failed: {doc.doctype} {doc.name}",
			message=frappe.get_traceback(),
		)


# System logs and queues: logging their own changes would be noise (and some of
# them are written on every request).
UPDATE_LOG_SKIP = {
	"Updated Document", "Cancelled Document", "Accounting Change Log", "Deleted Document",
	"Version", "Error Log",
	"Comment", "Communication", "Activity Log", "Access Log", "Notification Log",
	"Email Queue", "Email Queue Recipient", "Scheduled Job Log", "Route History", "View Log",
	"Prepared Report", "Console Log", "Document Follow", "Energy Point Log",
	"Integration Request", "Webhook Request Log", "Submission Queue", "Reminder",
}


def log_updated_document(doc, method=None):
	"""Add one Updated Document row for every field that changed when an existing
	record is saved, for all doctypes (registered under "*" in hooks.py).

	Changes inside child tables are logged per row and field. When a Job task is
	set to Pending, the task's Pending Reason is stored as the reason of that
	change. Logging must never stop the save, so any failure goes to the Error Log.
	"""
	flags = frappe.flags
	if doc.doctype in UPDATE_LOG_SKIP or flags.in_install or flags.in_migrate or flags.in_patch:
		return

	before = doc.get_doc_before_save()
	if not before:
		return

	try:
		from frappe.core.doctype.version.version import get_diff

		diff = get_diff(before, doc)
		if not diff:
			return

		rows = _updated_document_rows(doc, diff)
		for row in rows:
			frappe.get_doc(
				{
					"doctype": "Updated Document",
					"updated_doctype": doc.doctype,
					"updated_name": doc.name,
					"updated_by": frappe.session.user,
					"job": doc.name if doc.doctype == "Job" else doc.get("job"),
					**row,
				}
			).insert(ignore_permissions=True)
	except Exception:
		frappe.log_error(
			title=f"Updated Document log failed: {doc.doctype} {doc.name}",
			message=frappe.get_traceback(),
		)


def _updated_document_rows(doc, diff):
	skip_types = ("Password",)
	hidden = {
		df.fieldname for df in doc.meta.fields if df.fieldtype in skip_types
	}

	def text(value):
		return "" if value is None else frappe.utils.cstr(value)

	rows = []
	for field, old, new in diff.changed:
		if field not in hidden:
			rows.append({"field_changed": field, "old_value": text(old), "new_value": text(new)})

	for table, index, row_name, changes in diff.row_changed:
		for field, old, new in changes:
			row = {
				"field_changed": f"{table} › row {index + 1} › {field}",
				"old_value": text(old),
				"new_value": text(new),
			}
			if doc.doctype == "Job" and table == "tasks" and field == "status" and new == "Pending":
				task = next((t for t in doc.get(table) if t.name == row_name), None)
				row["reason"] = text(task.get("pending_reason")) if task else ""
			rows.append(row)

	for table, row in diff.added:
		rows.append({"field_changed": f"{table} › row added", "new_value": _row_summary(row)})
	for table, row in diff.removed:
		rows.append({"field_changed": f"{table} › row removed", "old_value": _row_summary(row)})

	return rows


def _row_summary(row):
	keep = {k: v for k, v in row.items() if v not in (None, "") and k not in (
		"name", "owner", "creation", "modified", "modified_by", "docstatus", "idx",
		"parent", "parentfield", "parenttype", "doctype",
	)}
	return frappe.as_json(keep)[:2000]


# Job visibility: Task Staff see only the Jobs that have a task assigned to them
# (the task's Employee is linked to the user through Employee.user_id). Every
# other role keeps seeing all Jobs.
def job_query_conditions(user=None):
	from jms.jms.doctype.job.job import is_task_staff_only

	user = user or frappe.session.user
	if not is_task_staff_only(user):
		return ""
	return (
		"`tabJob`.`name` in ("
		"select jt.parent from `tabJob Task` jt "
		"inner join `tabEmployee` e on e.name = jt.assigned_to "
		"where jt.parenttype = 'Job' and e.user_id = {user})"
	).format(user=frappe.db.escape(user))


def job_has_permission(doc, ptype=None, user=None):
	from jms.jms.doctype.job.job import is_task_staff_only

	user = user or frappe.session.user
	if not is_task_staff_only(user):
		return True
	return bool(
		frappe.db.sql(
			"""select 1 from `tabJob Task` jt
			inner join `tabEmployee` e on e.name = jt.assigned_to
			where jt.parent = %s and jt.parenttype = 'Job' and e.user_id = %s limit 1""",
			(doc.name, user),
		)
	)
