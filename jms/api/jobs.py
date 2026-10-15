# Copyright (c) 2026, Kenz and contributors
# Jobs list for the SBM frontend: each Job with its stage and money to collect,
# plus a count per tab. The dashboard uses the same call (small page_length).

import frappe
from frappe import _
from frappe.utils import flt, getdate, nowdate

from jms.api.job_state import get_stage
from jms.jms.doctype.job.job import LOCKED_JOB_STATUSES, is_office_user
from jms.jms.report.job_status_report.job_status_report import _sum_by_job, _task_counts

MAX_PAGE_LENGTH = 100
# The "Job" Accounting Dimension adds a `job` column to these; the money totals read it.
JOB_DIMENSION_TABLES = ("GL Entry", "Sales Invoice", "Purchase Invoice", "Payment Entry")
TABS = (
	"Processing Work", "Invoice Pending", "Amount Pending", "Exp Pending", "Completed", "Overdue", "Closed",
)
FIELDS = [
	"name", "job_title", "customer", "customer_name", "job_type", "status", "priority",
	"net_amount", "discount", "start_date", "expected_completion_date", "company",
]


@frappe.whitelist()
def list_jobs(
	tab=None, search=None, company=None, customer=None, agent=None, job_type=None,
	status=None, priority=None, from_date=None, to_date=None, start=0, page_length=20,
):
	"""One page of Jobs for a tab (a stage, "Overdue" or "Closed"; empty = all).
	Returns {jobs, total, tab_counts}."""
	check_office_user()
	if tab and tab not in TABS:
		frappe.throw(_("Tab must be one of: {0}").format(", ".join(TABS)))

	jobs = get_jobs(
		search=search, company=company, customer=customer, agent=agent, job_type=job_type,
		status=status, priority=priority, from_date=from_date, to_date=to_date,
	)
	tab_counts = {t: sum(1 for j in jobs if t in j.tabs) for t in TABS}
	tab_counts["All"] = len(jobs)
	rows = [j for j in jobs if not tab or tab in j.tabs]
	start = max(int(start or 0), 0)
	page_length = min(max(int(page_length or 20), 1), MAX_PAGE_LENGTH)
	return {"jobs": rows[start:start + page_length], "total": len(rows), "tab_counts": tab_counts}


def check_office_user():
	if not is_office_user():
		frappe.throw(_("You are not permitted to do this"), frappe.PermissionError)


def get_jobs(search=None, from_date=None, to_date=None, **equals):
	"""Jobs the user may read (newest change first) with stage and money added.
	equals: company, customer, agent, job_type, status, priority (empty ones are ignored)."""
	filters = {k: v for k, v in equals.items() if v}
	if from_date or to_date:
		filters["start_date"] = ["between", [from_date or "1900-01-01", to_date or "2999-12-31"]]
	or_filters = None
	if search:
		like = ["like", f"%{search}%"]
		or_filters = {"name": like, "job_title": like, "customer_name": like, "customer_mobile": like}

	jobs = frappe.get_list(
		"Job", fields=FIELDS, filters=filters, or_filters=or_filters,
		order_by="modified desc", limit_page_length=0,
	)
	add_stage_and_money(jobs)
	return jobs


def add_stage_and_money(jobs):
	"""Add stage, tasks_total, tasks_done, to_collect, to_pay, overdue and tabs to
	each Job. Same money rules as Job.get_financials, read in bulk."""
	if not jobs:
		return
	names = [j.name for j in jobs]
	m = _money_by_job(names)
	task_total, task_done = _task_counts(names)
	today = getdate(nowdate())

	for j in jobs:
		get = lambda key: flt(m[key].get(j.name))  # noqa: E731
		has_si = get("si_count") > 0
		received = get("received") - get("refunded")
		if has_si:
			to_collect = max(0.0, get("si_outstanding") - get("unallocated_received"))
		else:
			to_collect = max(0.0, flt(j.net_amount) - flt(j.discount) - received)
		to_pay = max(0.0, get("pi_outstanding") - get("unallocated_paid"))

		j.tasks_total = task_total.get(j.name, 0)
		j.tasks_done = task_done.get(j.name, 0)
		j.stage = get_stage(j.status, j.tasks_done >= j.tasks_total, has_si, to_collect, to_pay)
		j.to_collect = to_collect
		j.to_pay = to_pay
		j.overdue = bool(
			j.expected_completion_date
			and getdate(j.expected_completion_date) < today
			and j.status not in (*LOCKED_JOB_STATUSES, "Completed")
		)
		# A Closed job is settled: it is only on the Closed tab, not on a stage tab.
		j.tabs = ["Closed"] if j.status == "Closed" else [j.stage] + (["Overdue"] if j.overdue else [])


def has_job_dimension():
	"""True once the site has the "Job" Accounting Dimension (set up in ERPNext:
	Accounting Dimension, Reference Document Type = Job). Without it there are no
	job columns to read money from, so the totals are 0 instead of an error."""
	return all(frappe.db.has_column(t, "job") for t in JOB_DIMENSION_TABLES)


MONEY_METRICS = (
	"si_count", "si_outstanding", "pi_outstanding", "received", "refunded",
	"unallocated_received", "unallocated_paid",
)


def _money_by_job(names):
	"""{metric: {job: amount}} from submitted invoices and payments."""
	if not has_job_dimension():
		return {metric: {} for metric in MONEY_METRICS}
	pe = "`tabPayment Entry`"
	return {
		# SUM(1) counts the submitted Sales Invoices of each Job
		"si_count": _sum_by_job("`tabSales Invoice`", "1", names, "docstatus = 1"),
		"si_outstanding": _sum_by_job("`tabSales Invoice`", "outstanding_amount", names, "docstatus = 1"),
		"pi_outstanding": _sum_by_job("`tabPurchase Invoice`", "outstanding_amount", names, "docstatus = 1"),
		"received": _sum_by_job(pe, "paid_amount", names, _pe("Receive", "Customer")),
		"refunded": _sum_by_job(pe, "paid_amount", names, _pe("Pay", "Customer")),
		"unallocated_received": _sum_by_job(pe, "unallocated_amount", names, _pe("Receive", "Customer")),
		"unallocated_paid": _sum_by_job(pe, "unallocated_amount", names, _pe("Pay", "Supplier")),
	}


def _pe(payment_type, party_type):
	return f"docstatus = 1 AND payment_type = '{payment_type}' AND party_type = '{party_type}'"
