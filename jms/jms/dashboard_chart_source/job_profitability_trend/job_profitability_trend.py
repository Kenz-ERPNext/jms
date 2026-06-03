# Copyright (c) 2026, Kenz and contributors
# Dashboard Chart Source: monthly Income / Expense / Net Profit for jobs,
# from the Job accounting dimension on the GL.

import frappe
from frappe.utils import flt


@frappe.whitelist()
def get(
	chart_name=None,
	chart=None,
	no_cache=None,
	filters=None,
	from_date=None,
	to_date=None,
	timespan=None,
	time_interval=None,
	heatmap_year=None,
):
	company = None
	if filters:
		if isinstance(filters, str):
			filters = frappe.parse_json(filters)
		if isinstance(filters, dict):
			company = filters.get("company")

	cond = "gle.job IS NOT NULL AND gle.job != '' AND gle.is_cancelled = 0"
	params = {}
	if company:
		cond += " AND gle.company = %(company)s"
		params["company"] = company

	rows = frappe.db.sql(
		f"""
		SELECT DATE_FORMAT(gle.posting_date, '%%Y-%%m') AS ym,
			COALESCE(SUM(CASE WHEN a.root_type='Income' THEN gle.credit - gle.debit ELSE 0 END), 0) AS income,
			COALESCE(SUM(CASE WHEN a.root_type='Expense' THEN gle.debit - gle.credit ELSE 0 END), 0) AS expense
		FROM `tabGL Entry` gle
		JOIN `tabAccount` a ON a.name = gle.account
		WHERE {cond}
		GROUP BY ym
		ORDER BY ym
		""",
		params,
		as_dict=True,
	)

	labels = [r.ym for r in rows]
	income = [flt(r.income) for r in rows]
	expense = [flt(r.expense) for r in rows]
	net = [flt(r.income) - flt(r.expense) for r in rows]

	return {
		"labels": labels,
		"datasets": [
			{"name": "Income", "values": income},
			{"name": "Expense", "values": expense},
			{"name": "Net Profit", "values": net},
		],
	}
