# Copyright (c) 2026, Kenz and contributors
# Aggregate backend for the Job Profitability dashboard (number cards).
# All figures come from the Job accounting dimension on the GL, plus
# Payment Entry (received) and Sales Invoice (outstanding). Profit is
# ex-VAT; agent commission is excluded from Net Profit.

import frappe
from frappe.utils import flt

OUTSOURCING_ACCOUNT_NAME = "Outsourcing Cost"


def _company_from_filters(filters):
	if not filters:
		return None
	if isinstance(filters, str):
		filters = frappe.parse_json(filters)
	if isinstance(filters, dict):
		return filters.get("company")
	# list-style filters: [["Doc","company","=","X"], ...]
	for f in filters:
		if isinstance(f, (list, tuple)) and len(f) >= 4 and f[1] == "company":
			return f[3]
	return None


def get_totals(company=None):
	"""Return all per-company job totals in one pass."""
	cond = "gle.job IS NOT NULL AND gle.job != '' AND gle.is_cancelled = 0"
	params = {"oacct": OUTSOURCING_ACCOUNT_NAME}
	if company:
		cond += " AND gle.company = %(company)s"
		params["company"] = company

	gl = frappe.db.sql(
		f"""
		SELECT
			COALESCE(SUM(CASE WHEN a.root_type='Income' THEN gle.credit - gle.debit ELSE 0 END), 0) AS income,
			COALESCE(SUM(CASE WHEN a.root_type='Expense' AND a.account_name != %(oacct)s
				THEN gle.debit - gle.credit ELSE 0 END), 0) AS expenses,
			COALESCE(SUM(CASE WHEN a.account_name = %(oacct)s
				THEN gle.debit - gle.credit ELSE 0 END), 0) AS outsourcing
		FROM `tabGL Entry` gle
		JOIN `tabAccount` a ON a.name = gle.account
		WHERE {cond}
		""",
		params,
		as_dict=True,
	)[0]

	pe_cond = "pe.job IS NOT NULL AND pe.job != '' AND pe.docstatus = 1 AND pe.payment_type = 'Receive'"
	pe_params = {}
	if company:
		pe_cond += " AND pe.company = %(company)s"
		pe_params["company"] = company
	received = flt(frappe.db.sql(
		f"SELECT COALESCE(SUM(pe.paid_amount), 0) FROM `tabPayment Entry` pe WHERE {pe_cond}",
		pe_params,
	)[0][0])

	si_cond = "si.job IS NOT NULL AND si.job != '' AND si.docstatus = 1"
	si_params = {}
	if company:
		si_cond += " AND si.company = %(company)s"
		si_params["company"] = company
	outstanding = flt(frappe.db.sql(
		f"SELECT COALESCE(SUM(si.outstanding_amount), 0) FROM `tabSales Invoice` si WHERE {si_cond}",
		si_params,
	)[0][0])

	# Total Job Amount = sum of each job's priced value (gross_amount, ex-VAT),
	# matching the per-job Financial summary. Falls back to posted GL income if
	# no jobs carry priced items.
	job_cond = "j.status NOT IN ('Cancelled', 'Rejected')"
	job_params = {}
	if company:
		job_cond += " AND j.company = %(company)s"
		job_params["company"] = company
	job_amount = flt(frappe.db.sql(
		f"SELECT COALESCE(SUM(j.gross_amount), 0) FROM `tabJob` j WHERE {job_cond}",
		job_params,
	)[0][0])

	income = flt(gl.income)
	expenses = flt(gl.expenses)
	outsourcing = flt(gl.outsourcing)
	total_job_amount = job_amount or income
	return {
		"total_job_amount": total_job_amount,
		"total_expenses": expenses,
		"outsourcing_cost": outsourcing,
		"net_profit": total_job_amount - expenses - outsourcing,
		"total_received": received,
		"outstanding": outstanding,
	}


def _card(filters, key):
	totals = get_totals(_company_from_filters(filters))
	return {"value": flt(totals.get(key)), "fieldtype": "Currency"}


@frappe.whitelist()
def card_total_job_amount(filters=None, **kwargs):
	return _card(filters, "total_job_amount")


@frappe.whitelist()
def card_total_received(filters=None, **kwargs):
	return _card(filters, "total_received")


@frappe.whitelist()
def card_outstanding(filters=None, **kwargs):
	return _card(filters, "outstanding")


@frappe.whitelist()
def card_total_expenses(filters=None, **kwargs):
	return _card(filters, "total_expenses")


@frappe.whitelist()
def card_outsourcing_cost(filters=None, **kwargs):
	return _card(filters, "outsourcing_cost")


@frappe.whitelist()
def card_net_profit(filters=None, **kwargs):
	return _card(filters, "net_profit")
