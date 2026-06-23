# Copyright (c) 2026, Kenz and contributors
# Pending Tasks — every task not yet Completed, on jobs that are still open.

import frappe
from frappe import _

DEAD = ("Closed", "Cancelled", "Canceled", "Rejected")


def execute(filters=None):
	filters = filters or {}
	return get_columns(), get_data(filters)


def get_columns():
	return [
		{"fieldname": "job", "label": _("Job"), "fieldtype": "Link", "options": "Job", "width": 130},
		{"fieldname": "customer", "label": _("Customer"), "fieldtype": "Link", "options": "Customer", "width": 150},
		{"fieldname": "task_name", "label": _("Task"), "fieldtype": "Data", "width": 220},
		{"fieldname": "task_type", "label": _("Type"), "fieldtype": "Data", "width": 90},
		{"fieldname": "assigned_to", "label": _("Assigned To"), "fieldtype": "Data", "width": 150},
		{"fieldname": "due_date", "label": _("Due Date"), "fieldtype": "Date", "width": 100},
		{"fieldname": "status", "label": _("Status"), "fieldtype": "Data", "width": 110},
	]


def get_data(filters):
	conditions = [
		"t.parenttype = 'Job'",
		"COALESCE(t.status, '') != 'Completed'",
		f"j.status NOT IN ({', '.join(['%s'] * len(DEAD))})",
	]
	params = list(DEAD)
	if filters.get("company"):
		conditions.append("j.company = %s")
		params.append(filters["company"])
	if filters.get("job"):
		conditions.append("t.parent = %s")
		params.append(filters["job"])
	if filters.get("status"):
		conditions.append("t.status = %s")
		params.append(filters["status"])

	where = " AND ".join(conditions)
	return frappe.db.sql(
		f"""
		SELECT t.parent AS job, j.customer, t.task_name,
			t.employee__outsource AS task_type,
			COALESCE(NULLIF(t.assigned_to, ''), t.assigned_tos) AS assigned_to,
			t.due_date, t.status
		FROM `tabJob Task` t
		JOIN `tabJob` j ON j.name = t.parent
		WHERE {where}
		ORDER BY t.due_date IS NULL, t.due_date, t.parent
		""",
		params,
		as_dict=True,
	)
