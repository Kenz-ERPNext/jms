# Copyright (c) 2026, Kenz and contributors
# Month by month figures for the Dashboard charts: new jobs, and money received
# from customers (less refunds, the Job form's rule) for the last few months.

import frappe
from frappe.utils import add_months, flt, get_first_day, getdate, nowdate

MONTHS = 6


def monthly(company=None, months=MONTHS, show_money=True):
	"""[{month: "2026-10", jobs: n, received: amount or None}] oldest first, the
	current month last. Months without data are 0."""
	first = get_first_day(add_months(getdate(nowdate()), -(months - 1)))
	keys = [add_months(first, i).strftime("%Y-%m") for i in range(months)]
	params = {"from": first, "company": company}
	company_cond = " AND company = %(company)s" if company else ""

	jobs = dict(frappe.db.sql(
		f"""SELECT DATE_FORMAT(date, '%%Y-%%m'), COUNT(*) FROM `tabJob`
			WHERE date >= %(from)s{company_cond} GROUP BY 1""",
		params,
	))
	received = {}
	if show_money:
		received = dict(frappe.db.sql(
			f"""SELECT DATE_FORMAT(posting_date, '%%Y-%%m'),
					SUM(CASE WHEN payment_type = 'Receive' THEN paid_amount ELSE -paid_amount END)
				FROM `tabPayment Entry`
				WHERE docstatus = 1 AND party_type = 'Customer' AND IFNULL(job, '') != ''
					AND payment_type IN ('Receive', 'Pay') AND posting_date >= %(from)s{company_cond}
				GROUP BY 1""",
			params,
		))
	return [
		{
			"month": key,
			"jobs": int(jobs.get(key, 0)),
			"received": flt(received.get(key, 0)) if show_money else None,
		}
		for key in keys
	]
