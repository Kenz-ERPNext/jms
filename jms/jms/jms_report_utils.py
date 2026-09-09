# Copyright (c) 2026, Kenz and contributors
# Shared per-job financial aggregation for JMS reports. All figures come
# from the Job accounting dimension on the GL (ex-VAT), Payment Entry
# (received/paid) and Sales/Purchase Invoice (outstanding/balance).
# Used by Job Collection Report, Job Supplier Payment (Agent) Report and
# Job Profitability.

import frappe
from frappe.utils import flt

OUTSOURCING_ACCOUNT_NAME = "Outsourcing Cost"

_KEYS = (
	"job_amount", "expenses", "outsourcing", "received", "received_from_agent",
	"outstanding", "supplier_paid", "supplier_balance",
	"expense_returns", "payment_returns", "payment_returns_to_agent",
)


def get_job_financials_map(job_names):
	"""Return {job: {metric: value}} for the given jobs (one pass per source)."""
	job_names = [j for j in (job_names or []) if j]
	if not job_names:
		return {}

	result = {j: {k: 0.0 for k in _KEYS} for j in job_names}

	# --- GL: Income / Expense (excl. outsourcing) / Outsourcing (ex-VAT) ---
	for r in frappe.db.sql(
		"""
		SELECT gle.job,
			COALESCE(SUM(CASE WHEN a.root_type='Income' THEN gle.credit - gle.debit ELSE 0 END), 0) job_amount,
			COALESCE(SUM(CASE WHEN a.root_type='Expense' AND a.account_name != %(oacct)s
				THEN gle.debit - gle.credit ELSE 0 END), 0) expenses,
			COALESCE(SUM(CASE WHEN a.account_name = %(oacct)s
				THEN gle.debit - gle.credit ELSE 0 END), 0) outsourcing
		FROM `tabGL Entry` gle JOIN `tabAccount` a ON a.name = gle.account
		WHERE gle.job IN %(jobs)s AND gle.is_cancelled = 0
		GROUP BY gle.job
		""",
		{"jobs": job_names, "oacct": OUTSOURCING_ACCOUNT_NAME},
		as_dict=True,
	):
		result[r.job].update(job_amount=flt(r.job_amount), expenses=flt(r.expenses), outsourcing=flt(r.outsourcing))

	# job_amount falls back to the Job's own priced gross_amount when nothing
	# has been invoiced yet — matches Job.get_financials()'s total_job_amount,
	# which is known as soon as the job is priced, not only once a Sales
	# Invoice posts GL income. Without this, an un-invoiced job reads Job
	# Amount 0 here while its own Financial tab correctly shows the priced
	# total.
	for r in frappe.db.sql(
		"""SELECT name AS job, gross_amount FROM `tabJob` WHERE name IN %(jobs)s""",
		{"jobs": job_names}, as_dict=True,
	):
		if not result[r.job]["job_amount"]:
			result[r.job]["job_amount"] = flt(r.gross_amount)

	# --- Received (Payment Entry, Receive, FROM CUSTOMERS). party_type
	# filtered so an Expense Return (Receive, but from a Supplier) doesn't
	# inflate this. ---
	for r in frappe.db.sql(
		"""SELECT pe.job, COALESCE(SUM(pe.paid_amount), 0) v
			FROM `tabPayment Entry` pe
			WHERE pe.job IN %(jobs)s AND pe.docstatus=1 AND pe.payment_type='Receive'
			  AND pe.party_type='Customer'
			GROUP BY pe.job""",
		{"jobs": job_names}, as_dict=True,
	):
		result[r.job]["received"] = flt(r.v)

	# --- Received from Agent (party == job.agent_customer) ---
	for r in frappe.db.sql(
		"""SELECT pe.job, COALESCE(SUM(pe.paid_amount), 0) v
			FROM `tabPayment Entry` pe JOIN `tabJob` j ON j.name = pe.job
			WHERE pe.job IN %(jobs)s AND pe.docstatus=1 AND pe.payment_type='Receive'
			  AND pe.party_type='Customer'
			  AND j.agent_customer IS NOT NULL AND j.agent_customer != ''
			  AND pe.party = j.agent_customer
			GROUP BY pe.job""",
		{"jobs": job_names}, as_dict=True,
	):
		result[r.job]["received_from_agent"] = flt(r.v)

	# --- Payment Returns to Agent (party == job.agent_customer), so the
	# agent split still nets correctly below ---
	for r in frappe.db.sql(
		"""SELECT pe.job, COALESCE(SUM(pe.paid_amount), 0) v
			FROM `tabPayment Entry` pe JOIN `tabJob` j ON j.name = pe.job
			WHERE pe.job IN %(jobs)s AND pe.docstatus=1 AND pe.payment_type='Pay'
			  AND pe.party_type='Customer'
			  AND j.agent_customer IS NOT NULL AND j.agent_customer != ''
			  AND pe.party = j.agent_customer
			GROUP BY pe.job""",
		{"jobs": job_names}, as_dict=True,
	):
		result[r.job]["payment_returns_to_agent"] = flt(r.v)

	# --- Outstanding to receive (Sales Invoice) ---
	for r in frappe.db.sql(
		"""SELECT si.job, COALESCE(SUM(si.outstanding_amount), 0) v
			FROM `tabSales Invoice` si
			WHERE si.job IN %(jobs)s AND si.docstatus=1 GROUP BY si.job""",
		{"jobs": job_names}, as_dict=True,
	):
		result[r.job]["outstanding"] = flt(r.v)

	# --- Supplier Paid = ALL pay-side Payment Entries TO SUPPLIERS for the
	# job (incl. unallocated supplier / agent advances, not only
	# PI-allocated payments). party_type filtered so a Payment Return (Pay,
	# but to a Customer) doesn't inflate this. ---
	for r in frappe.db.sql(
		"""SELECT pe.job, COALESCE(SUM(pe.paid_amount), 0) v
			FROM `tabPayment Entry` pe
			WHERE pe.job IN %(jobs)s AND pe.docstatus=1 AND pe.payment_type='Pay'
			  AND pe.party_type='Supplier'
			GROUP BY pe.job""",
		{"jobs": job_names}, as_dict=True,
	):
		result[r.job]["supplier_paid"] = flt(r.v)

	# --- Supplier Balance (Purchase Invoice outstanding) ---
	for r in frappe.db.sql(
		"""SELECT pi.job, COALESCE(SUM(pi.outstanding_amount), 0) v
			FROM `tabPurchase Invoice` pi
			WHERE pi.job IN %(jobs)s AND pi.docstatus=1 GROUP BY pi.job""",
		{"jobs": job_names}, as_dict=True,
	):
		result[r.job]["supplier_balance"] = flt(r.v)

	# --- Expense Returns = money a Supplier refunded back to us (the
	# reverse of a Pay to that supplier). Nets against Supplier Paid, and
	# improves Net Profit below, since it's cash that came back. ---
	for r in frappe.db.sql(
		"""SELECT pe.job, COALESCE(SUM(pe.paid_amount), 0) v
			FROM `tabPayment Entry` pe
			WHERE pe.job IN %(jobs)s AND pe.docstatus=1 AND pe.payment_type='Receive'
			  AND pe.party_type='Supplier'
			GROUP BY pe.job""",
		{"jobs": job_names}, as_dict=True,
	):
		result[r.job]["expense_returns"] = flt(r.v)

	# --- Payment Returns = money we refunded back to the Customer (the
	# reverse of an Advance Receipt). Nets against Received. ---
	for r in frappe.db.sql(
		"""SELECT pe.job, COALESCE(SUM(pe.paid_amount), 0) v
			FROM `tabPayment Entry` pe
			WHERE pe.job IN %(jobs)s AND pe.docstatus=1 AND pe.payment_type='Pay'
			  AND pe.party_type='Customer'
			GROUP BY pe.job""",
		{"jobs": job_names}, as_dict=True,
	):
		result[r.job]["payment_returns"] = flt(r.v)

	# --- derived ---
	for d in result.values():
		d["received"] = flt(d["received"]) - flt(d["payment_returns"])
		d["received_from_agent"] = flt(d["received_from_agent"]) - flt(d["payment_returns_to_agent"])
		d["received_from_customer"] = flt(d["received"]) - flt(d["received_from_agent"])
		d["supplier_paid"] = flt(d["supplier_paid"]) - flt(d["expense_returns"])
		d["net_profit"] = (
			flt(d["job_amount"]) - flt(d["expenses"]) - flt(d["outsourcing"]) + flt(d["expense_returns"])
		)

	return result
