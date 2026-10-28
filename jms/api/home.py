# Copyright (c) 2026, Kenz and contributors
# Everything the SBM Dashboard shows, in one call: job counts per lifecycle status
# and per stage, money totals, and the jobs that need attention.

import frappe
from frappe.utils import flt, getdate

from jms.api.jobs import check_office_user, get_jobs, has_job_dimension
from jms.api.trends import monthly
from jms.jms.dashboard_api import get_totals

LIFECYCLE = ("Created", "In Progress", "Completed", "Closed")
STAGES = ("Processing Work", "Invoice Pending", "Amount Pending", "Exp Pending", "Completed")
LIST_LENGTH = 6
ROW_FIELDS = (
	"name", "job_title", "customer_name", "status", "stage", "net_amount", "to_collect",
	"expected_completion_date", "tasks_total", "tasks_done",
)
# Money total → the JMS Settings flag that shows it
MONEY_FLAGS = {
	"total_job_amount": "show_total_job_amount",
	"total_received": "show_total_received",
	"outstanding": "show_outstanding",
	"total_expenses": "show_total_expenses",
	"outsourcing_cost": "show_outsourcing_cost",
	"net_profit": "show_net_profit",
}


@frappe.whitelist()
def get_dashboard(company=None):
	check_office_user()
	jobs = get_jobs(company=company)
	# Closed jobs are settled; counting them in stages and lists would hide the open work.
	open_jobs = [j for j in jobs if j.status != "Closed"]
	money_ready = has_job_dimension()
	return {
		# no "Job" Accounting Dimension yet: money shows 0 and the page says what to set up
		"setup_needed": None if money_ready else "job_dimension",
		"lifecycle": [{"label": s, "count": sum(1 for j in jobs if j.status == s)} for s in LIFECYCLE],
		"stages": [{"label": s, "count": sum(1 for j in open_jobs if j.stage == s)} for s in STAGES],
		"money": _money(company) if money_ready else _no_money(),
		"to_invoice": _rows(
			[j for j in open_jobs if j.stage == "Invoice Pending"], "expected_completion_date", "net_amount"
		),
		"to_collect": _rows(
			[j for j in open_jobs if j.stage == "Amount Pending"], "to_collect", "to_collect", reverse=True
		),
		"overdue": _rows([j for j in open_jobs if j.overdue], "expected_completion_date"),
		"monthly": monthly(company, show_money=money_ready and _shown("show_total_received")),
	}


def _shown(flag):
	"""A JMS Settings flag; one never saved counts as on."""
	value = frappe.get_cached_doc("JMS Settings").get(flag)
	return value is None or bool(value)


def _rows(jobs, sort_key, amount_field=None, reverse=False):
	"""The first LIST_LENGTH jobs by sort_key, how many there are in all and, with
	amount_field, the sum of that field over all of them."""
	def key(job):
		value = job.get(sort_key)
		return getdate(value) if sort_key.endswith("date") and value else (value or 0)

	jobs = sorted(jobs, key=key, reverse=reverse)
	return {
		"total": len(jobs),
		"amount": sum(j.get(amount_field) or 0 for j in jobs) if amount_field else None,
		"rows": [{f: j.get(f) for f in ROW_FIELDS} for j in jobs[:LIST_LENGTH]],
	}


def _money(company):
	"""Totals the JMS Settings allow (a flag never saved counts as on)."""
	settings = frappe.get_cached_doc("JMS Settings")
	totals = get_totals(company)
	# get_totals counts every Receive (also supplier and employee refunds) and does not
	# take off money refunded to customers. Use the Job form's rule instead, so this
	# equals the sum of "Total Amount Received" over all jobs.
	totals["total_received"] = _received_from_customers(company)
	# Like the Job form, money a supplier paid back (Expense Return) adds to profit.
	totals["net_profit"] += _expense_returns(company)
	return [
		{"key": key, "value": totals[key]}
		for key, flag in MONEY_FLAGS.items()
		if settings.get(flag) is None or settings.get(flag)
	]


def _no_money():
	"""The money cards the JMS Settings allow, all 0."""
	return [{"key": key, "value": 0} for key, flag in MONEY_FLAGS.items() if _shown(flag)]


def _expense_returns(company=None):
	"""Money suppliers paid back to us, tagged to a job."""
	cond = "docstatus = 1 AND payment_type = 'Receive' AND party_type = 'Supplier' AND IFNULL(job, '') != ''"
	if company:
		cond += " AND company = %(company)s"
	return flt(frappe.db.sql(
		f"SELECT COALESCE(SUM(paid_amount), 0) FROM `tabPayment Entry` WHERE {cond}", {"company": company}
	)[0][0])


def _received_from_customers(company=None):
	"""Customer payments tagged to a job, less refunds paid back to customers."""
	cond = "docstatus = 1 AND party_type = 'Customer' AND IFNULL(job, '') != ''"
	if company:
		cond += " AND company = %(company)s"
	return flt(frappe.db.sql(
		f"""SELECT COALESCE(SUM(CASE WHEN payment_type = 'Receive' THEN paid_amount
				WHEN payment_type = 'Pay' THEN -paid_amount ELSE 0 END), 0)
			FROM `tabPayment Entry` WHERE {cond}""",
		{"company": company},
	)[0][0])
