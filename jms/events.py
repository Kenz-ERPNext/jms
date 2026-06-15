# Copyright (c) 2026, Kenz and contributors
# Doc-event handlers for invoices linked to a Job.

import frappe


def on_sales_invoice_cancel(doc, method=None):
	"""When a Sales Invoice is cancelled, clear the Job's back-reference so the
	invoice can be deleted/amended (Frappe blocks deleting a doc that another
	doc still links to) and the "Create Sales Invoice" action becomes available
	again. Uses db.set_value to avoid re-triggering Job validation."""
	for job in frappe.get_all("Job", filters={"linked_invoice": doc.name}, pluck="name"):
		frappe.db.set_value(
			"Job",
			job,
			{
				"linked_invoice": None,
				"sales_invoice_status": "",
				"sales_invoice_payment_entry": None,
			},
			update_modified=False,
		)


def on_purchase_invoice_cancel(doc, method=None):
	"""When a Purchase Invoice is cancelled, clear the Job's back-reference so
	it can be deleted/amended and can be re-created from the Job."""
	for job in frappe.get_all("Job", filters={"purchase_invoice": doc.name}, pluck="name"):
		frappe.db.set_value(
			"Job",
			job,
			{
				"purchase_invoice": None,
				"purchase_invoice_status": "",
			},
			update_modified=False,
		)
