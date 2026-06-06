# Copyright (c) 2026, Kenz and contributors
# Job Supplier Payment Report (Agent Report) — full date-wise statement.
# View = Detail (one row per job, grouped by Agent) or Summary (one row per
# Agent with totals). Figures from the Job accounting dimension.

import frappe
from frappe.utils import flt

from jms.jms.jms_report_utils import get_job_financials_map

_FIN_COLS = [
	("job_amount", "Job Amount"),
	("received", "Received"),
	("outstanding", "Outstanding"),
	("outsourcing", "Outsourcing"),
	("supplier_paid", "Supplier Paid"),
	("supplier_balance", "Supplier Balance"),
	("net_profit", "Net Profit"),
]


def execute(filters=None):
	filters = filters or {}
	view = filters.get("view") or "Detail"
	rows = _build_rows(filters)
	if view == "Summary":
		return _summary_columns(), _summarise(rows)
	return _detail_columns(), rows


def _detail_columns():
	cols = [
		{"label": "Agent", "fieldname": "agent", "fieldtype": "Link", "options": "Agent", "width": 130},
		{"label": "Date", "fieldname": "date", "fieldtype": "Date", "width": 90},
		{"label": "Job", "fieldname": "job", "fieldtype": "Link", "options": "Job", "width": 120},
		{"label": "Customer", "fieldname": "customer", "fieldtype": "Link", "options": "Customer", "width": 150},
		{"label": "Outsourced Party", "fieldname": "outsourced_party", "fieldtype": "Data", "width": 150},
		{"label": "Status", "fieldname": "job_status", "fieldtype": "Data", "width": 95},
	]
	cols += [{"label": l, "fieldname": k, "fieldtype": "Currency", "width": 115} for k, l in _FIN_COLS]
	return cols


def _summary_columns():
	return [
		{"label": "Agent", "fieldname": "agent", "fieldtype": "Link", "options": "Agent", "width": 180},
		{"label": "# Jobs", "fieldname": "jobs", "fieldtype": "Int", "width": 80},
	] + [{"label": l, "fieldname": k, "fieldtype": "Currency", "width": 120} for k, l in _FIN_COLS]


def _build_rows(filters):
	conditions = ["j.docstatus < 2"]
	values = {}
	if filters.get("from_date"):
		conditions.append("j.date >= %(from_date)s"); values["from_date"] = filters["from_date"]
	if filters.get("to_date"):
		conditions.append("j.date <= %(to_date)s"); values["to_date"] = filters["to_date"]
	if filters.get("agent"):
		conditions.append("j.agent = %(agent)s"); values["agent"] = filters["agent"]
	if filters.get("customer"):
		conditions.append("j.customer = %(customer)s"); values["customer"] = filters["customer"]
	if filters.get("status"):
		conditions.append("j.status = %(status)s"); values["status"] = filters["status"]
	if filters.get("only_outsource"):
		conditions.append("EXISTS (SELECT 1 FROM `tabJob Task` jt WHERE jt.parent=j.name AND jt.employee__outsource='Outsource')")

	jobs = frappe.db.sql(
		f"""SELECT j.name AS job, j.date, j.customer, j.agent, j.status AS job_status,
				(SELECT GROUP_CONCAT(DISTINCT jt.assigned_tos SEPARATOR ', ')
					FROM `tabJob Task` jt
					WHERE jt.parent=j.name AND jt.employee__outsource='Outsource'
					  AND jt.assigned_tos IS NOT NULL AND jt.assigned_tos != '') AS outsourced_party
			FROM `tabJob` j
			WHERE {' AND '.join(conditions)}
			ORDER BY COALESCE(j.agent, 'zzzz') ASC, j.date DESC, j.name DESC""",
		values, as_dict=True,
	)
	fin = get_job_financials_map([j.job for j in jobs])
	rows = []
	for j in jobs:
		f = fin.get(j.job, {})
		row = dict(j)
		for k, _ in _FIN_COLS:
			row[k] = f.get(k, 0)
		rows.append(row)
	return rows


def _summarise(rows):
	by_agent = {}
	for r in rows:
		key = r.get("agent") or "(No Agent)"
		agg = by_agent.setdefault(key, {"agent": r.get("agent"), "jobs": 0, **{k: 0.0 for k, _ in _FIN_COLS}})
		agg["jobs"] += 1
		for k, _ in _FIN_COLS:
			agg[k] = flt(agg[k]) + flt(r.get(k, 0))
	out = list(by_agent.values())
	out.sort(key=lambda d: d.get("net_profit", 0), reverse=True)
	return out
