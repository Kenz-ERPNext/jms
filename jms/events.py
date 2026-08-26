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
	can be deleted/amended and re-created, and reopen the job if it was Closed.
	The outsource task rows that pointed at it are cleared too, so they no
	longer look billed."""
	for job in frappe.get_all("Job", filters={"purchase_invoice": doc.name}, pluck="name"):
		frappe.db.set_value(
			"Job", job,
			{"purchase_invoice": None, "purchase_invoice_status": ""},
			update_modified=False,
		)
	for row in frappe.get_all("Job Task", filters={"purchase_invoice": doc.name}, pluck="name"):
		frappe.db.set_value("Job Task", row, "purchase_invoice", None, update_modified=False)
	_reopen_job_if_closed(doc.get("job"))


def on_sales_invoice_submit(doc, method=None):
	"""A submitted Sales Invoice tagged to a Job (typically the amendment of a
	cancelled one) becomes that Job's linked invoice again, so the form stops
	offering 'Create Sales Invoice' / 'Creation is Pending' for a billed job."""
	if doc.get("job"):
		frappe.db.set_value(
			"Job", doc.job,
			{"linked_invoice": doc.name, "sales_invoice_status": "Created"},
			update_modified=False,
		)


def on_purchase_invoice_submit(doc, method=None):
	"""When a cancelled outsource Purchase Invoice is amended and re-submitted,
	move the Job Task rows (and the Job's back-reference) from the cancelled
	name to the new one. Expense Purchase Invoices are never referenced by a
	task row, so they are left alone."""
	if not (doc.get("job") and doc.get("amended_from")):
		return
	rows = frappe.get_all("Job Task", filters={"purchase_invoice": doc.amended_from, "parent": doc.job}, pluck="name")
	if not rows:
		return
	for row in rows:
		frappe.db.set_value("Job Task", row, "purchase_invoice", doc.name, update_modified=False)
	frappe.db.set_value(
		"Job", doc.job,
		{"purchase_invoice": doc.name, "purchase_invoice_status": "Created"},
		update_modified=False,
	)


def on_payment_entry_cancel(doc, method=None):
	"""Cancelling a payment removes received/paid amount, so a Closed job is no
	longer fully settled — reopen it. (Receivable/payable figures themselves are
	recomputed live by get_financials, which already excludes cancelled docs.)
	If it was the Job's tracked Sales Invoice payment, drop that reference."""
	for job in frappe.get_all("Job", filters={"sales_invoice_payment_entry": doc.name}, pluck="name"):
		frappe.db.set_value("Job", job, "sales_invoice_payment_entry", None, update_modified=False)
	_reopen_job_if_closed(doc.get("job"))
