# Copyright (c) 2026, Kenz and contributors
# Doc-event handlers for documents linked to a Job.

import frappe


def _reopen_job_if_closed(job_name):
	"""A 'Closed' Job requires all tasks Completed AND the full amount received.
	Cancelling a linked Sales/Purchase Invoice or Payment breaks that basis, so
	revert the job from Closed back to Completed (tasks are still done) and clear
	its closing_date — keeping the Lifecycle stepper in sync with Work & Money."""
	if job_name and frappe.db.get_value("Job", job_name, "status") == "Closed":
		frappe.db.set_value(
			"Job", job_name,
			{"status": "Completed", "closing_date": None},
			update_modified=False,
		)


def on_sales_invoice_cancel(doc, method=None):
	"""When a Sales Invoice is cancelled, clear the Job's back-reference so the
	invoice can be deleted/amended and 'Create Sales Invoice' is available again,
	and reopen the job if it was Closed. Uses db.set_value to avoid re-triggering
	Job validation."""
	for job in frappe.get_all("Job", filters={"linked_invoice": doc.name}, pluck="name"):
		frappe.db.set_value(
			"Job", job,
			{"linked_invoice": None, "sales_invoice_status": "", "sales_invoice_payment_entry": None},
			update_modified=False,
		)
	_reopen_job_if_closed(doc.get("job"))


def on_purchase_invoice_cancel(doc, method=None):
	"""When a Purchase Invoice is cancelled, clear the Job's back-reference so it
	can be deleted/amended and re-created, and reopen the job if it was Closed."""
	for job in frappe.get_all("Job", filters={"purchase_invoice": doc.name}, pluck="name"):
		frappe.db.set_value(
			"Job", job,
			{"purchase_invoice": None, "purchase_invoice_status": ""},
			update_modified=False,
		)
	_reopen_job_if_closed(doc.get("job"))


def on_payment_entry_cancel(doc, method=None):
	"""Cancelling a payment removes received/paid amount, so a Closed job is no
	longer fully settled — reopen it. (Receivable/payable figures themselves are
	recomputed live by get_financials, which already excludes cancelled docs.)"""
	_reopen_job_if_closed(doc.get("job"))
