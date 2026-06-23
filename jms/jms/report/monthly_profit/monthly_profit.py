# Copyright (c) 2026, Kenz and contributors
# Monthly Profit — recognized profit of CLOSED jobs grouped by closing month.
# Management view; profit is attributed entirely to the job's closing month.

import frappe
from frappe import _
from frappe.utils import flt, getdate

from jms.jms.report_helpers import job_costs


def execute(filters=None):
	filters = filters or {}
	return get_columns(), get_data(filters)


def get_columns():
	return [
		{"fieldname": "month", "label": _("Month"), "fieldtype": "Data", "width": 130},
		{"fieldname": "jobs", "label": _("Closed Jobs"), "fieldtype": "Int", "width": 110},
		{"fieldname": "job_value", "label": _("Job Value"), "fieldtype": "Currency", "width": 150},
		{"fieldname": "cost", "label": _("Cost"), "fieldtype": "Currency", "width": 150},
		{"fieldname": "profit", "label": _("Profit"), "fieldtype": "Currency", "width": 150},
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

	where = " AND ".join(conditions)
	jobs = frappe.db.sql(
		f"""SELECT j.name, j.closing_date, j.gross_amount
			FROM `tabJob` j WHERE {where}""",
		params,
		as_dict=True,
	)
	if not jobs:
		return []

	costs = job_costs([j.name for j in jobs])

	# aggregate by closing month (sortable key YYYY-MM -> display "Mon YYYY")
	buckets = {}
	for j in jobs:
		d = getdate(j.closing_date)
		key = f"{d.year:04d}-{d.month:02d}"
		b = buckets.setdefault(key, {"month": d.strftime("%b %Y"), "jobs": 0, "job_value": 0.0, "cost": 0.0})
		b["jobs"] += 1
		b["job_value"] += flt(j.gross_amount)
		b["cost"] += flt(costs.get(j.name))

	rows = []
	for key in sorted(buckets):
		b = buckets[key]
		b["profit"] = b["job_value"] - b["cost"]
		rows.append(b)
	return rows
