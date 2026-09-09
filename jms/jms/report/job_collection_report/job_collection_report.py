# Copyright (c) 2026, Kenz and contributors
# Job Collection Report — full date-wise collection / financial statement
# per job (NOT just pending). Figures from the Job accounting dimension.

import frappe

from jms.jms.jms_report_utils import get_job_financials_map


def execute(filters=None):
	filters = filters or {}
	return get_columns(), get_data(filters)


def get_columns():
	return [
		{"label": "Date", "fieldname": "date", "fieldtype": "Date", "width": 95},
		{"label": "Job ID", "fieldname": "job", "fieldtype": "Link", "options": "Job", "width": 130},
		{"label": "Customer", "fieldname": "customer", "fieldtype": "Link", "options": "Customer", "width": 160},
		{"label": "Agent", "fieldname": "agent", "fieldtype": "Link", "options": "Agent", "width": 120},
		{"label": "Status", "fieldname": "job_status", "fieldtype": "Data", "width": 100},
		{"label": "Mode of Payment", "fieldname": "mode_of_payment", "fieldtype": "Link", "options": "Mode of Payment", "width": 130},
		{"label": "Job Amount", "fieldname": "job_amount", "fieldtype": "Currency", "width": 120},
		{"label": "Received", "fieldname": "received", "fieldtype": "Currency", "width": 120},
		{"label": "Outstanding", "fieldname": "outstanding", "fieldtype": "Currency", "width": 120},
		{"label": "Expenses", "fieldname": "expenses", "fieldtype": "Currency", "width": 110},
		{"label": "Outsourcing", "fieldname": "outsourcing", "fieldtype": "Currency", "width": 110},
		{"label": "Expense Returns", "fieldname": "expense_returns", "fieldtype": "Currency", "width": 120},
		{"label": "Payment Returns", "fieldname": "payment_returns", "fieldtype": "Currency", "width": 120},
		{"label": "Net Profit", "fieldname": "net_profit", "fieldtype": "Currency", "width": 120},
	]


def get_data(filters):
	conditions = ["j.docstatus < 2"]
	values = {}
	if filters.get("from_date"):
		conditions.append("j.date >= %(from_date)s"); values["from_date"] = filters["from_date"]
	if filters.get("to_date"):
		conditions.append("j.date <= %(to_date)s"); values["to_date"] = filters["to_date"]
	if filters.get("job"):
		conditions.append("j.name = %(job)s"); values["job"] = filters["job"]
	if filters.get("customer"):
		conditions.append("j.customer = %(customer)s"); values["customer"] = filters["customer"]
	if filters.get("agent"):
		conditions.append("j.agent = %(agent)s"); values["agent"] = filters["agent"]
	if filters.get("status"):
		conditions.append("j.status = %(status)s"); values["status"] = filters["status"]

	jobs = frappe.db.sql(
		f"""SELECT j.name AS job, j.date, j.customer, j.agent,
				j.status AS job_status, j.mode_of_payment
			FROM `tabJob` j
			WHERE {' AND '.join(conditions)}
			ORDER BY j.date DESC, j.name DESC""",
		values, as_dict=True,
	)
	fin = get_job_financials_map([j.job for j in jobs])

	rows = []
	only_pending = filters.get("only_pending")
	for j in jobs:
		f = fin.get(j.job, {})
		row = dict(j)
		row.update(
			job_amount=f.get("job_amount", 0),
			received=f.get("received", 0),
			outstanding=f.get("outstanding", 0),
			expenses=f.get("expenses", 0),
			outsourcing=f.get("outsourcing", 0),
			expense_returns=f.get("expense_returns", 0),
			payment_returns=f.get("payment_returns", 0),
			net_profit=f.get("net_profit", 0),
		)
		if only_pending and not (row["outstanding"] > 0):
			continue
		rows.append(row)
	return rows
