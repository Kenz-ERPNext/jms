# Copyright (c) 2026, Kenz and contributors
# For license information, please see license.txt
#
# Job Profitability — per-job financials from the Job accounting dimension.
# Supersedes job_gross_profit / job_collection_report / job_supplier_payment_report.
# Profit is EX-VAT (tax accounts are Liability/Asset and excluded automatically);
# Agent Commission is NOT subtracted from Net Profit.

import frappe
from frappe.utils import flt


def execute(filters=None):
	filters = filters or {}
	settings = frappe.get_cached_doc("JMS Settings")
	columns = get_columns(settings)
	data = get_data(filters, settings)
	return columns, data


def get_columns(settings):
	columns = [
		{"label": "Job", "fieldname": "job", "fieldtype": "Link", "options": "Job", "width": 130},
		{"label": "Date", "fieldname": "date", "fieldtype": "Date", "width": 95},
		{"label": "Customer", "fieldname": "customer", "fieldtype": "Link", "options": "Customer", "width": 150},
		{"label": "Agent", "fieldname": "agent", "fieldtype": "Link", "options": "Agent", "width": 120},
		{"label": "Status", "fieldname": "status", "fieldtype": "Data", "width": 110},
	]
	optional = [
		("show_total_job_amount", "Job Amount", "total_job_amount"),
		("show_total_received", "Received", "total_received"),
		("show_outstanding", "Outstanding", "outstanding"),
		("show_total_expenses", "Expenses", "total_expenses"),
		("show_outsourcing_cost", "Outsourcing", "outsourcing_cost"),
		("show_expense_returns", "Expense Returns", "expense_returns"),
		("show_payment_returns", "Payment Returns", "payment_returns"),
		("show_net_profit", "Net Profit", "net_profit"),
		("show_profit_balance", "Profit Balance", "profit_balance"),
	]
	for flag, label, fieldname in optional:
		if settings.get(flag):
			columns.append(
				{"label": label, "fieldname": fieldname, "fieldtype": "Currency", "width": 120}
			)
	# financial state indicators
	columns.append({"label": "Fin. State", "fieldname": "fin_state", "fieldtype": "Data", "width": 130})
	return columns


def _job_conditions(filters):
	conditions = "j.docstatus < 2"
	if filters.get("company"):
		conditions += " AND j.company = %(company)s"
	if filters.get("from_date"):
		conditions += " AND j.date >= %(from_date)s"
	if filters.get("to_date"):
		conditions += " AND j.date <= %(to_date)s"
	if filters.get("customer"):
		conditions += " AND j.customer = %(customer)s"
	if filters.get("agent"):
		conditions += " AND j.agent = %(agent)s"
	if filters.get("status"):
		conditions += " AND j.status = %(status)s"
	return conditions


def get_data(filters, settings):
	jobs = frappe.db.sql(
		f"""
		SELECT j.name AS job, j.date, j.customer, j.agent, j.status,
			j.agent_customer, j.receivable_from
		FROM `tabJob` j
		WHERE {_job_conditions(filters)}
		ORDER BY j.date DESC, j.name DESC
		""",
		filters,
		as_dict=True,
	)
	if not jobs:
		return []

	job_names = [j.job for j in jobs]

	# Dedicated outsourcing accounts (one per company)
	outsourcing_accounts = frappe.get_all(
		"Account", filters={"account_name": "Outsourcing Cost"}, pluck="name"
	)

	gl = _gl_by_job(job_names, outsourcing_accounts)
	received = _received_by_job(job_names)
	outstanding = _outstanding_by_job(job_names)
	returns = _returns_by_job(job_names)

	rows = []
	for j in jobs:
		g = gl.get(j.job, {})
		income = flt(g.get("income"))
		expenses = flt(g.get("expenses"))
		outsourcing = flt(g.get("outsourcing"))
		ret = returns.get(j.job, {})
		expense_returns = flt(ret.get("expense_returns"))
		payment_returns = flt(ret.get("payment_returns"))
		# Expense Returns are cash that came back, so they directly improve
		# profit, same as Job.get_financials().
		net_profit = income - expenses - outsourcing + expense_returns
		# Received is netted against Payment Returns so it reflects what the
		# customer actually kept paid, not the raw gross receipt total.
		recv = flt(received.get(j.job)) - payment_returns
		outst = flt(outstanding.get(j.job))
		# Profit Balance = remaining receivable minus remaining payable
		profit_balance = outst - flt(g.get("payable_outstanding"))

		states = []
		if settings.enable_amount_pending_indicator and outst > 0:
			states.append("Amount Pending")
		if settings.enable_exp_pending_indicator and flt(g.get("payable_outstanding")) > 0:
			states.append("Exp. Pending")

		rows.append(
			{
				"job": j.job,
				"date": j.date,
				"customer": j.customer,
				"agent": j.agent,
				"status": j.status,
				"total_job_amount": income,
				"total_received": recv,
				"outstanding": outst,
				"total_expenses": expenses,
				"outsourcing_cost": outsourcing,
				"expense_returns": expense_returns,
				"payment_returns": payment_returns,
				"net_profit": net_profit,
				"profit_balance": profit_balance,
				"fin_state": ", ".join(states),
			}
		)
	return rows


def _gl_by_job(job_names, outsourcing_accounts):
	"""Income / Expense / Outsourcing per job from GL (ex-VAT)."""
	oacct = outsourcing_accounts or [""]
	rows = frappe.db.sql(
		f"""
		SELECT gle.job,
			COALESCE(SUM(CASE WHEN a.root_type='Income' THEN gle.credit - gle.debit ELSE 0 END), 0) AS income,
			COALESCE(SUM(CASE WHEN a.root_type='Expense' AND gle.account NOT IN %(oacct)s
				THEN gle.debit - gle.credit ELSE 0 END), 0) AS expenses,
			COALESCE(SUM(CASE WHEN gle.account IN %(oacct)s
				THEN gle.debit - gle.credit ELSE 0 END), 0) AS outsourcing
		FROM `tabGL Entry` gle
		JOIN `tabAccount` a ON a.name = gle.account
		WHERE gle.job IN %(jobs)s AND gle.is_cancelled = 0
		GROUP BY gle.job
		""",
		{"jobs": job_names, "oacct": oacct},
		as_dict=True,
	)
	result = {r.job: r for r in rows}

	# Unpaid payables per job (for Exp. Pending)
	pay = frappe.db.sql(
		"""
		SELECT pi.job, COALESCE(SUM(pi.outstanding_amount), 0) AS payable_outstanding
		FROM `tabPurchase Invoice` pi
		WHERE pi.job IN %(jobs)s AND pi.docstatus = 1
		GROUP BY pi.job
		""",
		{"jobs": job_names},
		as_dict=True,
	)
	for p in pay:
		result.setdefault(p.job, frappe._dict())["payable_outstanding"] = p.payable_outstanding
	return result


def _received_by_job(job_names):
	# party_type filtered so an Expense Return (Receive, but from a
	# Supplier) doesn't inflate this.
	rows = frappe.db.sql(
		"""
		SELECT pe.job, COALESCE(SUM(pe.paid_amount), 0) AS received
		FROM `tabPayment Entry` pe
		WHERE pe.job IN %(jobs)s AND pe.docstatus = 1 AND pe.payment_type = 'Receive'
		  AND pe.party_type = 'Customer'
		GROUP BY pe.job
		""",
		{"jobs": job_names},
		as_dict=True,
	)
	return {r.job: r.received for r in rows}


def _returns_by_job(job_names):
	"""Expense Returns (Receive from Supplier) and Payment Returns (Pay to
	Customer) per job — the reverse-direction Payment Entries created by
	Job.create_expense_return / Job.create_payment_return."""
	result = {}
	for r in frappe.db.sql(
		"""
		SELECT pe.job, COALESCE(SUM(pe.paid_amount), 0) AS v
		FROM `tabPayment Entry` pe
		WHERE pe.job IN %(jobs)s AND pe.docstatus = 1 AND pe.payment_type = 'Receive'
		  AND pe.party_type = 'Supplier'
		GROUP BY pe.job
		""",
		{"jobs": job_names},
		as_dict=True,
	):
		result.setdefault(r.job, {})["expense_returns"] = r.v
	for r in frappe.db.sql(
		"""
		SELECT pe.job, COALESCE(SUM(pe.paid_amount), 0) AS v
		FROM `tabPayment Entry` pe
		WHERE pe.job IN %(jobs)s AND pe.docstatus = 1 AND pe.payment_type = 'Pay'
		  AND pe.party_type = 'Customer'
		GROUP BY pe.job
		""",
		{"jobs": job_names},
		as_dict=True,
	):
		result.setdefault(r.job, {})["payment_returns"] = r.v
	return result


def _outstanding_by_job(job_names):
	rows = frappe.db.sql(
		"""
		SELECT si.job, COALESCE(SUM(si.outstanding_amount), 0) AS outstanding
		FROM `tabSales Invoice` si
		WHERE si.job IN %(jobs)s AND si.docstatus = 1
		GROUP BY si.job
		""",
		{"jobs": job_names},
		as_dict=True,
	)
	return {r.job: r.outstanding for r in rows}
