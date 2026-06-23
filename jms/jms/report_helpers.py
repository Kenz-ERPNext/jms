# Copyright (c) 2026, Kenz and contributors
# Shared helpers for the SBM/JMS management reports.

import frappe
from frappe.utils import flt


def job_costs(job_names):
	"""{job: total cost} = expenses + outsourcing (ex-VAT) from the GL, by Job
	dimension. Matches the 'Cost' used in get_financials (all Expense root_type
	postings, which already includes the outsourcing-cost account)."""
	if not job_names:
		return {}
	rows = frappe.db.sql(
		"""
		SELECT gle.job AS job, COALESCE(SUM(gle.debit - gle.credit), 0) AS cost
		FROM `tabGL Entry` gle
		JOIN `tabAccount` a ON a.name = gle.account
		WHERE gle.is_cancelled = 0 AND a.root_type = 'Expense'
		  AND gle.job IN %(jobs)s
		GROUP BY gle.job
		""",
		{"jobs": job_names},
		as_dict=True,
	)
	return {r.job: flt(r.cost) for r in rows}


def job_received(job_names):
	"""{job: total received} from submitted Receive Payment Entries."""
	if not job_names:
		return {}
	rows = frappe.db.sql(
		"""
		SELECT job, COALESCE(SUM(paid_amount), 0) AS amt
		FROM `tabPayment Entry`
		WHERE docstatus = 1 AND payment_type = 'Receive' AND job IN %(jobs)s
		GROUP BY job
		""",
		{"jobs": job_names},
		as_dict=True,
	)
	return {r.job: flt(r.amt) for r in rows}


def job_task_progress(job_names):
	"""{job: (total_tasks, completed_tasks)} from the Job Task child table."""
	if not job_names:
		return {}
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
	return {r.parent: (int(r.total or 0), int(r.done or 0)) for r in rows}
