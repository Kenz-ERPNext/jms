# Copyright (c) 2026, Kenz and contributors
# Employee Task Report — tasks assigned to internal employees, with status.

import frappe
from frappe import _


def execute(filters=None):
	filters = filters or {}
	return get_columns(), get_data(filters)


def get_columns():
	return [
		{"fieldname": "assigned_to", "label": _("Assigned To"), "fieldtype": "Data", "width": 170},
		{"fieldname": "job", "label": _("Job"), "fieldtype": "Link", "options": "Job", "width": 130},
		{"fieldname": "task_name", "label": _("Task"), "fieldtype": "Data", "width": 230},
		{"fieldname": "due_date", "label": _("Due Date"), "fieldtype": "Date", "width": 100},
		{"fieldname": "status", "label": _("Status"), "fieldtype": "Data", "width": 110},
	]


def get_data(filters):
	conditions = [
		"t.parenttype = 'Job'",
		"COALESCE(t.employee__outsource, '') = 'Employee'",
	]
	params = []
	if filters.get("company"):
		conditions.append("j.company = %s")
		params.append(filters["company"])
	if filters.get("assigned_to"):
		conditions.append("(t.assigned_to = %s OR t.assigned_tos = %s)")
		params.extend([filters["assigned_to"], filters["assigned_to"]])
	if filters.get("status"):
		conditions.append("t.status = %s")
		params.append(filters["status"])

	where = " AND ".join(conditions)
	return frappe.db.sql(
		f"""
		SELECT COALESCE(NULLIF(t.assigned_to, ''), t.assigned_tos) AS assigned_to,
			t.parent AS job, t.task_name, t.due_date, t.status
		FROM `tabJob Task` t
		JOIN `tabJob` j ON j.name = t.parent
		WHERE {where}
		ORDER BY assigned_to, t.due_date IS NULL, t.due_date
		""",
		params,
		as_dict=True,
	)
