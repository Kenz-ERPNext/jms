# Copyright (c) 2026, Kenz and contributors
# My Tasks: the tasks assigned to the logged-in user (through their Employee), or
# every task for office users, and changing the status of one of them. The Job is
# saved normally, so its rules all run: Pending Reason, Task Staff may change only
# their own tasks, the Job status follows its tasks, and the change is logged in
# Updated Document.

import frappe
from frappe import _
from frappe.utils import add_days, getdate, nowdate

from jms.jms.doctype.job.job import LOCKED_JOB_STATUSES, STAFF_STATUSES, is_office_user

DONE_DAYS = 30  # completed tasks stay on the list this long


def _my_employees(user=None):
	return frappe.get_all("Employee", filters={"user_id": user or frappe.session.user}, pluck="name")


@frappe.whitelist()
def my_tasks(assigned_to=None):
	"""Open, In Progress and Pending tasks, plus those completed in the last DONE_DAYS
	days, with their job and who they are assigned to.
	Office users (who manage all jobs) get every task, or one employee's with
	assigned_to; anyone else gets the tasks of their own Employee. has_employee is
	False when such a user is not linked to an Employee."""
	params = {"since": add_days(nowdate(), -DONE_DAYS)}
	office = is_office_user()
	if office:
		cond = "AND t.assigned_to = %(assigned_to)s" if assigned_to else ""
		params["assigned_to"] = assigned_to
	else:
		params["employees"] = _my_employees()
		if not params["employees"]:
			return {"scope": "mine", "has_employee": False, "tasks": []}
		cond = "AND t.assigned_to IN %(employees)s"
	tasks = frappe.db.sql(
		f"""SELECT t.name, t.task_name, t.status, t.pending_reason, t.due_date, t.priority,
				t.completion_date, t.employee__outsource, t.assigned_to, e.employee_name,
				t.outsource_supplier, j.name AS job, j.job_title, j.customer_name
			FROM `tabJob Task` t JOIN `tabJob` j ON j.name = t.parent
			LEFT JOIN `tabEmployee` e ON e.name = t.assigned_to
			WHERE t.parenttype = 'Job' {cond}
				AND j.status NOT IN ('Cancelled', 'Rejected', 'Closed')
				AND (t.status IN ('Open', 'In Progress', 'Pending')
					OR (t.status = 'Completed' AND t.completion_date >= %(since)s))
			ORDER BY t.due_date IS NULL, t.due_date, j.name""",
		params,
		as_dict=True,
	)
	today = getdate(nowdate())
	for t in tasks:
		t.overdue = bool(t.due_date and t.status != "Completed" and getdate(t.due_date) < today)
	return {"scope": "all" if office else "mine", "has_employee": True, "tasks": tasks}


@frappe.whitelist(methods=["POST"])
def set_task_status(task, status, pending_reason=None):
	"""Set the status of one task. Task Staff: only a task assigned to them."""
	parent = frappe.db.get_value("Job Task", {"name": task, "parenttype": "Job"}, "parent")
	if not parent:
		frappe.throw(_("Task {0} not found").format(task), frappe.DoesNotExistError)
	job = frappe.get_doc("Job", parent)
	job.check_permission("write")
	row = next(t for t in job.tasks if t.name == task)

	if row.assigned_to not in _my_employees() and not is_office_user():
		frappe.throw(_("This task is not assigned to you"), frappe.PermissionError)
	if job.status in LOCKED_JOB_STATUSES:
		frappe.throw(_("Job {0} is {1}; its tasks cannot be changed").format(job.name, job.status))
	if status not in STAFF_STATUSES:
		frappe.throw(_("Status must be one of: {0}").format(", ".join(STAFF_STATUSES)))
	reason = (pending_reason or "").strip()
	if status == "Pending" and not reason:
		frappe.throw(_("Please give a Pending Reason"))

	previous = row.status
	row.status = status
	row.pending_reason = reason if status == "Pending" else None
	if status == "Completed":
		row.completion_date = row.completion_date or nowdate()
	elif previous == "Completed":
		row.completion_date = None
	job.save()
	return {"task": task, "status": status, "job_status": job.status}
