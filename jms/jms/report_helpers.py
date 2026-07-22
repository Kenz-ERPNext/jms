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


def closed_jobs_empty_message(filters=None):
	"""Explain an empty Closed-jobs profit report: profit is recognized only on
	Close, so say whether Closed Jobs exist outside the date range or, if none
	were ever closed, how many Jobs already meet the closing conditions."""
	from frappe import _

	filters = filters or {}
	company_cond, params = "", {}
	if filters.get("company"):
		company_cond = " AND j.company = %(company)s"
		params["company"] = filters["company"]

	total_closed = frappe.db.sql(
		f"SELECT COUNT(*) FROM `tabJob` j WHERE j.status = 'Closed'{company_cond}",
		params,
	)[0][0]
	if total_closed:
		return _(
			"No Jobs were closed in the selected period — {0} Closed Job(s) exist "
			"outside this date range. Widen the Closed From / Closed To filters."
		).format(total_closed)

	# same conditions as Job.validate_closing: every task Completed AND the
	# full amount received (0.5 rounding tolerance)
	eligible = frappe.db.sql(
		f"""
		SELECT COUNT(*) FROM `tabJob` j
		WHERE j.status NOT IN ('Closed', 'Cancelled', 'Rejected'){company_cond}
		  AND NOT EXISTS (
			SELECT 1 FROM `tabJob Task` t
			WHERE t.parenttype = 'Job' AND t.parent = j.name
			  AND COALESCE(t.status, '') != 'Completed'
		  )
		  AND COALESCE(j.net_amount, 0) - COALESCE((
			SELECT SUM(pe.paid_amount) FROM `tabPayment Entry` pe
			WHERE pe.job = j.name AND pe.docstatus = 1 AND pe.payment_type = 'Receive'
		  ), 0) <= 0.5
		""",
		params,
	)[0][0]

	msg = _(
		"No Job has been closed yet — profit is recognized only when a Job is "
		"closed with the Close Job button on the Job form (requires all tasks "
		"Completed and the full amount received)."
	)
	if eligible:
		msg += " " + _(
			"{0} Job(s) currently meet the closing conditions and can be closed now."
		).format(eligible)
	return msg
