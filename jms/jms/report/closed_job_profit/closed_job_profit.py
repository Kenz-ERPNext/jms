# Copyright (c) 2026, Kenz and contributors
# Profit recognized per Job on its Closing Date (management view — independent
# of the GL/accrual P&L). Only Closed jobs appear, in their closing month.

import frappe
from frappe import _
from frappe.utils import flt, getdate

from jms.jms.report_helpers import closed_jobs_empty_message, job_costs


def execute(filters=None):
	filters = filters or {}
	data = get_data(filters)
	message = None if data else closed_jobs_empty_message(filters)
	return get_columns(), data, message


def get_columns():
	return [
		{"fieldname": "name", "label": _("Job"), "fieldtype": "Link", "options": "Job", "width": 130},
		{"fieldname": "job_title", "label": _("Title"), "fieldtype": "Data", "width": 180},
		{"fieldname": "customer", "label": _("Customer"), "fieldtype": "Link", "options": "Customer", "width": 150},
		{"fieldname": "closing_date", "label": _("Closing Date"), "fieldtype": "Date", "width": 110},
		{"fieldname": "closing_month", "label": _("Profit Month"), "fieldtype": "Data", "width": 110},
		{"fieldname": "job_value", "label": _("Job Value"), "fieldtype": "Currency", "width": 130},
		{"fieldname": "cost", "label": _("Cost"), "fieldtype": "Currency", "width": 130},
		{"fieldname": "profit", "label": _("Profit"), "fieldtype": "Currency", "width": 130},
	]


def get_data(filters):
	conditions = ["j.status = 'Closed'", "j.closing_date IS NOT NULL"]
	params = {}
	if filters.get("company"):
		conditions.append("j.company = %(company)s")
		params["company"] = filters["company"]
	if filters.get("from_date"):
		conditions.append("j.closing_date >= %(from_date)s")
		params["from_date"] = filters["from_date"]
	if filters.get("to_date"):
		conditions.append("j.closing_date <= %(to_date)s")
		params["to_date"] = filters["to_date"]
	if filters.get("customer"):
		conditions.append("j.customer = %(customer)s")
		params["customer"] = filters["customer"]

	where = " AND ".join(conditions)
	jobs = frappe.db.sql(
		f"""
		SELECT j.name, j.job_title, j.customer, j.closing_date, j.gross_amount
		FROM `tabJob` j
		WHERE {where}
		ORDER BY j.closing_date, j.name
		""",
		params,
		as_dict=True,
	)
	if not jobs:
		return []

	costs = job_costs([j.name for j in jobs])
	rows = []
	for j in jobs:
		cost = flt(costs.get(j.name))
		value = flt(j.gross_amount)
		rows.append({
			"name": j.name,
			"job_title": j.job_title,
			"customer": j.customer,
			"closing_date": j.closing_date,
			"closing_month": getdate(j.closing_date).strftime("%b %Y"),
			"job_value": value,
			"cost": cost,
			"profit": value - cost,
		})
	return rows
