# Copyright (c) 2026, Kenz and contributors
# Cash Collection — money actually RECEIVED, by date (the cash-flow view).
# Independent of profit recognition: a receipt shows here in the month it
# arrives, even if the Job's profit is recognized later on its closing date.

import frappe
from frappe import _


def execute(filters=None):
	filters = filters or {}
	return get_columns(), get_data(filters)


def get_columns():
	return [
		{"fieldname": "posting_date", "label": _("Date"), "fieldtype": "Date", "width": 100},
		{"fieldname": "payment_entry", "label": _("Receipt"), "fieldtype": "Link", "options": "Payment Entry", "width": 170},
		{"fieldname": "party", "label": _("Received From"), "fieldtype": "Data", "width": 180},
		{"fieldname": "job", "label": _("Job"), "fieldtype": "Link", "options": "Job", "width": 130},
		{"fieldname": "mode_of_payment", "label": _("Mode"), "fieldtype": "Link", "options": "Mode of Payment", "width": 120},
		{"fieldname": "amount", "label": _("Amount"), "fieldtype": "Currency", "width": 140},
	]


def get_data(filters):
	# party_type='Customer' — an Expense Return is also a "Receive" Payment
	# Entry (money back from a Supplier), and without this filter it would
	# show up here looking like a customer collection.
	conditions = ["pe.docstatus = 1", "pe.payment_type = 'Receive'", "pe.party_type = 'Customer'"]
	params = {}
	if filters.get("company"):
		conditions.append("pe.company = %(company)s")
		params["company"] = filters["company"]
	if filters.get("from_date"):
		conditions.append("pe.posting_date >= %(from_date)s")
		params["from_date"] = filters["from_date"]
	if filters.get("to_date"):
		conditions.append("pe.posting_date <= %(to_date)s")
		params["to_date"] = filters["to_date"]
	if filters.get("job"):
		conditions.append("pe.job = %(job)s")
		params["job"] = filters["job"]
	if filters.get("mode_of_payment"):
		conditions.append("pe.mode_of_payment = %(mode_of_payment)s")
		params["mode_of_payment"] = filters["mode_of_payment"]

	where = " AND ".join(conditions)
	return frappe.db.sql(
		f"""
		SELECT pe.posting_date, pe.name AS payment_entry, pe.party,
			pe.job, pe.mode_of_payment, pe.paid_amount AS amount
		FROM `tabPayment Entry` pe
		WHERE {where}
		ORDER BY pe.posting_date, pe.name
		""",
		params,
		as_dict=True,
	)
