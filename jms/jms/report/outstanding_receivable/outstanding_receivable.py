# Copyright (c) 2026, Kenz and contributors
# Outstanding Receivable — jobs where money is still to be collected
# (job value minus amount received), across all open jobs.

import frappe
from frappe import _
from frappe.utils import flt

from jms.jms.report_helpers import job_received

DEAD = ("Cancelled", "Canceled", "Rejected")


def execute(filters=None):
	filters = filters or {}
	return get_columns(), get_data(filters)


def get_columns():
	return [
		{"fieldname": "name", "label": _("Job"), "fieldtype": "Link", "options": "Job", "width": 130},
		{"fieldname": "customer", "label": _("Customer"), "fieldtype": "Link", "options": "Customer", "width": 160},
		{"fieldname": "status", "label": _("Status"), "fieldtype": "Data", "width": 100},
		{"fieldname": "job_value", "label": _("Job Value"), "fieldtype": "Currency", "width": 130},
		{"fieldname": "received", "label": _("Received"), "fieldtype": "Currency", "width": 130},
		{"fieldname": "outstanding", "label": _("Outstanding"), "fieldtype": "Currency", "width": 140},
	]


def get_data(filters):
	conditions = [f"j.status NOT IN ({', '.join(['%s'] * len(DEAD))})"]
	params = list(DEAD)
	if filters.get("company"):
		conditions.append("j.company = %s")
		params.append(filters["company"])
	if filters.get("customer"):
		conditions.append("j.customer = %s")
		params.append(filters["customer"])

	where = " AND ".join(conditions)
	jobs = frappe.db.sql(
		f"""SELECT j.name, j.customer, j.status, j.net_amount
			FROM `tabJob` j WHERE {where}""",
		params,
		as_dict=True,
	)
	if not jobs:
		return []

	recv = job_received([j.name for j in jobs])
	rows = []
	for j in jobs:
		value = flt(j.net_amount)
		received = flt(recv.get(j.name))
		outstanding = value - received
		if outstanding <= 0.5:  # nothing meaningful left to collect
			continue
		rows.append({
			"name": j.name,
			"customer": j.customer,
			"status": j.status,
			"job_value": value,
			"received": received,
			"outstanding": outstanding,
		})
	rows.sort(key=lambda r: r["outstanding"], reverse=True)
	return rows
