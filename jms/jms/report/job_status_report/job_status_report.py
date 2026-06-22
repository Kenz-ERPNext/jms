# Copyright (c) 2025, Your Company and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.utils import flt


# Scenario filter values (match job_status_report.js)
SCENARIO_COLLECTION = "Remaining for Collection"
SCENARIO_PAYMENT = "Remaining for Payment"
SCENARIO_TASK = "Remaining for Task Completion"
SCENARIO_COMPLETED = "All Completed"

CANCELLED_STATUSES = ("Cancelled", "Canceled", "Rejected")


def execute(filters=None):
	filters = filters or {}
	columns = get_columns()
	data = get_data(filters)
	return columns, data


def get_columns():
	return [
		{"fieldname": "name", "label": _("Job ID"), "fieldtype": "Link", "options": "Job", "width": 130},
		{"fieldname": "job_title", "label": _("Job Title"), "fieldtype": "Data", "width": 180},
		{"fieldname": "customer", "label": _("Customer"), "fieldtype": "Link", "options": "Customer", "width": 150},
		{"fieldname": "job_type", "label": _("Job Type"), "fieldtype": "Link", "options": "Job Type", "width": 110},
		{"fieldname": "status", "label": _("Status"), "fieldtype": "Data", "width": 110},
		{"fieldname": "stage", "label": _("Stage"), "fieldtype": "Data", "width": 140},
		{"fieldname": "tasks_summary", "label": _("Tasks Done"), "fieldtype": "Data", "width": 90},
		{"fieldname": "to_collect", "label": _("To Collect"), "fieldtype": "Currency", "width": 120},
		{"fieldname": "to_pay", "label": _("To Pay (Exp.)"), "fieldtype": "Currency", "width": 120},
		{"fieldname": "start_date", "label": _("Start Date"), "fieldtype": "Date", "width": 100},
		{"fieldname": "expected_end_date", "label": _("Expected End"), "fieldtype": "Date", "width": 110},
		{"fieldname": "total_amount", "label": _("Amount"), "fieldtype": "Currency", "width": 120},
		{"fieldname": "billing_status", "label": _("Billing Status"), "fieldtype": "Data", "width": 110},
	]


def get_data(filters):
	conditions = ["1=1"]
	params = {}

	if filters.get("company"):
		conditions.append("j.company = %(company)s")
		params["company"] = filters.get("company")

	if filters.get("status"):
		conditions.append("j.status = %(status)s")
		params["status"] = filters.get("status")

	if filters.get("job_type"):
		conditions.append("j.job_type = %(job_type)s")
		params["job_type"] = filters.get("job_type")

	if filters.get("customer"):
		conditions.append("j.customer = %(customer)s")
		params["customer"] = filters.get("customer")

	if filters.get("from_date"):
		conditions.append("j.start_date >= %(from_date)s")
		params["from_date"] = filters.get("from_date")

	if filters.get("to_date"):
		conditions.append("j.start_date <= %(to_date)s")
		params["to_date"] = filters.get("to_date")

	where_clause = " AND ".join(conditions)

	jobs = frappe.db.sql(
		f"""
		SELECT
			j.name, j.job_title, j.customer, j.job_type, j.priority, j.status,
			j.start_date, j.expected_completion_date AS expected_end_date,
			j.net_amount AS total_amount, j.billing_status
		FROM `tabJob` j
		WHERE {where_clause}
		ORDER BY j.creation DESC
		""",
		params,
		as_dict=True,
	)

	if not jobs:
		return []

	job_names = [j.name for j in jobs]

	si_out = _sum_by_job(
		"`tabSales Invoice`", "outstanding_amount", job_names, "docstatus = 1"
	)
	pi_out = _sum_by_job(
		"`tabPurchase Invoice`", "outstanding_amount", job_names, "docstatus = 1"
	)
	unalloc_recv = _sum_by_job(
		"`tabPayment Entry`", "unallocated_amount", job_names,
		"docstatus = 1 AND payment_type = 'Receive'",
	)
	unalloc_pay = _sum_by_job(
		"`tabPayment Entry`", "unallocated_amount", job_names,
		"docstatus = 1 AND payment_type = 'Pay'",
	)
	task_total, task_done = _task_counts(job_names)

	scenario = filters.get("scenario")
	rows = []

	for j in jobs:
		net_receivable = max(0.0, flt(si_out.get(j.name)) - flt(unalloc_recv.get(j.name)))
		net_payable = max(0.0, flt(pi_out.get(j.name)) - flt(unalloc_pay.get(j.name)))
		total = task_total.get(j.name, 0)
		done = task_done.get(j.name, 0)
		tasks_complete = (total == 0) or (done >= total)
		is_cancelled = (j.status or "") in CANCELLED_STATUSES

		stage = _stage(is_cancelled, tasks_complete, net_receivable, net_payable)

		# scenario filter (A/B/C/D)
		if scenario == SCENARIO_COLLECTION and net_receivable <= 0:
			continue
		if scenario == SCENARIO_PAYMENT and net_payable <= 0:
			continue
		if scenario == SCENARIO_TASK and (tasks_complete or is_cancelled):
			continue
		if scenario == SCENARIO_COMPLETED and not (
			tasks_complete and net_receivable <= 0 and net_payable <= 0 and not is_cancelled
		):
			continue

		j["stage"] = stage
		j["tasks_summary"] = f"{done}/{total}" if total else _("No tasks")
		j["to_collect"] = net_receivable
		j["to_pay"] = net_payable
		rows.append(j)

	return rows


def _stage(is_cancelled, tasks_complete, net_receivable, net_payable):
	if is_cancelled:
		return "Cancelled"
	if not tasks_complete:
		return "Processing Work"
	amount_pending = net_receivable > 0
	exp_pending = net_payable > 0
	if amount_pending and exp_pending:
		return "Amount + Exp Pending"
	if amount_pending:
		return "Amount Pending"
	if exp_pending:
		return "Exp Pending"
	return "Completed"


def _sum_by_job(table, field, job_names, extra_where):
	"""Return {job: SUM(field)} for the given doctype table, scoped to jobs."""
	rows = frappe.db.sql(
		f"""
		SELECT job, COALESCE(SUM({field}), 0) AS total
		FROM {table}
		WHERE {extra_where} AND job IN %(jobs)s
		GROUP BY job
		""",
		{"jobs": job_names},
		as_dict=True,
	)
	return {r.job: flt(r.total) for r in rows}


def _task_counts(job_names):
	"""Return (total_by_job, completed_by_job) from the Job Task child table."""
	rows = frappe.db.sql(
		"""
		SELECT parent,
			COUNT(*) AS total,
			SUM(CASE WHEN status = 'Completed' THEN 1 ELSE 0 END) AS done
		FROM `tabJob Task`
		WHERE parenttype = 'Job' AND parent IN %(jobs)s
		GROUP BY parent
		""",
		{"jobs": job_names},
		as_dict=True,
	)
	total = {r.parent: int(r.total or 0) for r in rows}
	done = {r.parent: int(r.done or 0) for r in rows}
	return total, done
