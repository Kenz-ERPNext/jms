# Copyright (c) 2026, Kenz and contributors
# Outsourcing Pending Tasks — outsourced tasks not yet Completed, with the
# vendor and the task cost. (Paid/Pending is tracked per supplier via Purchase
# Invoices / advances, not per task, so this shows the task cost + vendor.)

import frappe
from frappe import _

DEAD = ("Closed", "Cancelled", "Canceled", "Rejected")


def execute(filters=None):
	filters = filters or {}
	return get_columns(), get_data(filters)


def get_columns():
	return [
		{"fieldname": "job", "label": _("Job"), "fieldtype": "Link", "options": "Job", "width": 130},
		{"fieldname": "task_name", "label": _("Task"), "fieldtype": "Data", "width": 220},
		{"fieldname": "vendor", "label": _("Vendor"), "fieldtype": "Link", "options": "Supplier", "width": 160},
		{"fieldname": "task_cost", "label": _("Task Cost"), "fieldtype": "Currency", "width": 120},
		{"fieldname": "due_date", "label": _("Due Date"), "fieldtype": "Date", "width": 100},
		{"fieldname": "status", "label": _("Status"), "fieldtype": "Data", "width": 110},
	]


def get_data(filters):
	conditions = [
		"t.parenttype = 'Job'",
		"t.employee__outsource = 'Outsource'",
		"COALESCE(t.status, '') != 'Completed'",
		f"j.status NOT IN ({', '.join(['%s'] * len(DEAD))})",
	]
	params = list(DEAD)
	if filters.get("company"):
		conditions.append("j.company = %s")
		params.append(filters["company"])
	if filters.get("vendor"):
		conditions.append("t.outsource_supplier = %s")
		params.append(filters["vendor"])

	where = " AND ".join(conditions)
	return frappe.db.sql(
		f"""
		SELECT t.parent AS job, t.task_name, t.outsource_supplier AS vendor,
			t.outsource_charge AS task_cost, t.due_date, t.status
		FROM `tabJob Task` t
		JOIN `tabJob` j ON j.name = t.parent
		WHERE {where}
		ORDER BY t.due_date IS NULL, t.due_date, t.parent
		""",
		params,
		as_dict=True,
	)
