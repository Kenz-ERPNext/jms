# Copyright (c) 2026, Kenz and contributors
# Free Jobs that still point to an already-cancelled invoice, so those
# invoices can be deleted/amended. Going forward this is handled by the
# on_cancel doc events (jms.events). Idempotent.

import frappe


def execute():
	# Sales Invoices: Job.linked_invoice -> cancelled SI
	for r in frappe.db.sql(
		"""SELECT j.name FROM `tabJob` j
			JOIN `tabSales Invoice` si ON si.name = j.linked_invoice
			WHERE si.docstatus = 2""",
		as_dict=True,
	):
		frappe.db.set_value(
			"Job",
			r.name,
			{
				"linked_invoice": None,
				"sales_invoice_status": "",
				"sales_invoice_payment_entry": None,
			},
			update_modified=False,
		)

	# Purchase Invoices: Job.purchase_invoice -> cancelled PI
	for r in frappe.db.sql(
		"""SELECT j.name FROM `tabJob` j
			JOIN `tabPurchase Invoice` pi ON pi.name = j.purchase_invoice
			WHERE pi.docstatus = 2""",
		as_dict=True,
	):
		frappe.db.set_value(
			"Job",
			r.name,
			{
				"purchase_invoice": None,
				"purchase_invoice_status": "",
			},
			update_modified=False,
		)

	frappe.db.commit()
