# Copyright (c) 2026, Kenz and contributors
# Work In Progress — OPEN (not yet Closed/Cancelled/Rejected) jobs: their value,
# how much has been received, what's still pending, and task completion %.
# Shows management how much value is tied up in unfinished jobs.

import frappe
from frappe import _
from frappe.utils import flt

from jms.jms.report_helpers import job_received, job_task_progress

CLOSED_OR_DEAD = ("Closed", "Cancelled", "Canceled", "Rejected")


def execute(filters=None):
	filters = filters or {}
	return get_columns(), get_data(filters)


def get_columns():
	return [
		{"fieldname": "name", "label": _("Job"), "fieldtype": "Link", "options": "Job", "width": 130},
		{"fieldname": "job_title", "label": _("Title"), "fieldtype": "Data", "width": 170},
		{"fieldname": "customer", "label": _("Customer"), "fieldtype": "Link", "options": "Customer", "width": 150},
		{"fieldname": "status", "label": _("Status"), "fieldtype": "Data", "width": 100},
		{"fieldname": "job_value", "label": _("Job Value"), "fieldtype": "Currency", "width": 120},
		{"fieldname": "received", "label": _("Received"), "fieldtype": "Currency", "width": 120},
		{"fieldname": "pending", "label": _("Pending"), "fieldtype": "Currency", "width": 120},
		{"fieldname": "completion", "label": _("Completion %"), "fieldtype": "Percent", "width": 110},
	]


def get_data(filters):
	conditions = [f"j.status NOT IN ({', '.join(['%s'] * len(CLOSED_OR_DEAD))})"]
	params = list(CLOSED_OR_DEAD)
	if filters.get("company"):
		conditions.append("j.company = %s")
		params.append(filters["company"])
	if filters.get("customer"):
		conditions.append("j.customer = %s")
		params.append(filters["customer"])

	where = " AND ".join(conditions)
	jobs = frappe.db.sql(
		f"""SELECT j.name, j.job_title, j.customer, j.status, j.net_amount
			FROM `tabJob` j WHERE {where} ORDER BY j.creation DESC""",
		params,
		as_dict=True,
	)
	if not jobs:
		return []

	names = [j.name for j in jobs]
	recv = job_received(names)
	progress = job_task_progress(names)

	rows = []
	for j in jobs:
		value = flt(j.net_amount)
		received = flt(recv.get(j.name))
		total, done = progress.get(j.name, (0, 0))
		rows.append({
			"name": j.name,
			"job_title": j.job_title,
			"customer": j.customer,
			"status": j.status,
			"job_value": value,
			"received": received,
			"pending": max(0.0, value - received),
			"completion": (done * 100.0 / total) if total else 0.0,
		})
	return rows
