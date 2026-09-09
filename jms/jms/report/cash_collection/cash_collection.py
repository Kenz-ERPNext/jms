# Copyright (c) 2026, Kenz and contributors
# Cash Collection — customer cash flow, by date: money that came IN
# ("Collection") and money that went back OUT as a refund ("Return").
# Returns are shown as negative amounts so the report's own total nets to
# what the company actually kept. Independent of profit recognition: a
# receipt shows here in the month it arrives, even if the Job's profit is
# recognized later on its closing date.

import frappe
from frappe import _


def execute(filters=None):
	filters = filters or {}
	return get_columns(), get_data(filters)


def get_columns():
	return [
		{"fieldname": "posting_date", "label": _("Date"), "fieldtype": "Date", "width": 100},
		{"fieldname": "payment_entry", "label": _("Receipt"), "fieldtype": "Link", "options": "Payment Entry", "width": 170},
		{"fieldname": "type", "label": _("Type"), "fieldtype": "Data", "width": 90},
		{"fieldname": "party", "label": _("Party"), "fieldtype": "Data", "width": 180},
		{"fieldname": "job", "label": _("Job"), "fieldtype": "Link", "options": "Job", "width": 130},
		{"fieldname": "mode_of_payment", "label": _("Mode"), "fieldtype": "Link", "options": "Mode of Payment", "width": 120},
		{"fieldname": "amount", "label": _("Amount"), "fieldtype": "Currency", "width": 140},
	]


def get_data(filters):
	# Both halves are scoped to party_type='Customer' — this is a customer
	# cash-flow view. An Expense Return (Receive, but from a Supplier) or an
	# outsource payment (Pay, but to a Supplier) belong to the supplier side
	# of the books, not here.
	conditions = ["pe.docstatus = 1"]
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
		SELECT pe.posting_date, pe.name AS payment_entry, 'Collection' AS type,
			pe.party, pe.job, pe.mode_of_payment, pe.paid_amount AS amount
		FROM `tabPayment Entry` pe
		WHERE {where} AND pe.payment_type = 'Receive' AND pe.party_type = 'Customer'

		UNION ALL

		SELECT pe.posting_date, pe.name AS payment_entry, 'Return' AS type,
			pe.party, pe.job, pe.mode_of_payment, -pe.paid_amount AS amount
		FROM `tabPayment Entry` pe
		WHERE {where} AND pe.payment_type = 'Pay' AND pe.party_type = 'Customer'

		ORDER BY posting_date, payment_entry
		""",
		params,
		as_dict=True,
	)
