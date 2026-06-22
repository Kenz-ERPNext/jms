# Copyright (c) 2026, Kenz and contributors
# Re-run of the v1_3 cleanup. Frappe runs each patch only once, so if v1_3 had
# already run on a site BEFORE an invoice was cancelled, the stale Job back-ref
# was never cleared and the invoice can't be deleted / a new one can't be made.
# This fresh patch guarantees the cleanup applies on the next migrate. Idempotent.

import frappe


def execute():
	if not frappe.db.table_exists("Job"):
		return

	# Sales Invoices: Job.linked_invoice -> a cancelled SI
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

	# Purchase Invoices: Job.purchase_invoice -> a cancelled PI
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
