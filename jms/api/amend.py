# Copyright (c) 2026, Kenz and contributors
# Amend, the SBM way: a cancelled Sales Invoice, Purchase Invoice or Payment Entry of a
# Job is made again by the same Job method that made it (create_invoice,
# create_expense, ...) with the edited values. The first new document of that DocType
# becomes the amendment (amended_from set, so Frappe names it X-1), as ERPNext's Amend.

import frappe
from frappe import _
from frappe.handler import run_doc_method

AMENDABLE = ("Sales Invoice", "Purchase Invoice", "Payment Entry")
JOB_METHODS = (
	"create_invoice",
	"create_pinvoice",
	"create_expense",
	"create_advance_receipt",
	"create_outsource_advance_payment",
	"create_expense_return",
	"create_payment_return",
)


@frappe.whitelist(methods=["POST"])
def run_amendment(job, method, amended_doctype, amended_from, args=None):
	"""Run a Job create method; its first new `amended_doctype` amends `amended_from`."""
	if method not in JOB_METHODS:
		frappe.throw(_("{0} is not a job action").format(method))
	if amended_doctype not in AMENDABLE:
		frappe.throw(_("{0} cannot be amended here").format(amended_doctype))

	old = frappe.db.get_value(
		amended_doctype, amended_from, ["docstatus", "job", "custom_job"], as_dict=True
	)
	if not old:
		frappe.throw(_("{0} {1} not found").format(amended_doctype, amended_from))
	if old.docstatus != 2:
		frappe.throw(_("Cancel {0} before amending it").format(amended_from))
	if job not in (old.job, old.custom_job):
		frappe.throw(_("{0} does not belong to job {1}").format(amended_from, job))
	if frappe.db.exists(amended_doctype, {"amended_from": amended_from}):
		frappe.throw(_("{0} is already amended").format(amended_from))

	amend = frappe.flags.jms_amend = {"doctype": amended_doctype, "name": amended_from}
	try:
		run_doc_method(method, dt="Job", dn=job, args=args)
	finally:
		frappe.flags.jms_amend = None
	# e.g. Payment Return amending a Sales Invoice: nothing was amended, so undo it all
	if not amend.get("used"):
		frappe.throw(_("{0} did not make a new {1}").format(method, amended_doctype))
	return frappe.response.get("message")


def set_amended_from(doc, method=None):
	"""before_insert of the amendable DocTypes: the first new one during run_amendment
	is the amendment. Runs before naming, so the name is the amended one (X-1).

	Cancelling an invoice unlinks its payment, which stays as the job's advance. An
	amended invoice gets the job's advances, like create_invoice and create_pinvoice
	already give theirs (create_expense does not), so it is not left unpaid."""
	amend = frappe.flags.get("jms_amend")
	if not amend or amend.get("used") or doc.doctype != amend["doctype"]:
		return
	doc.amended_from = amend["name"]
	amend["used"] = True
	job = doc.get("job") or doc.get("custom_job")
	if doc.doctype in ("Sales Invoice", "Purchase Invoice") and job and not doc.get("advances"):
		frappe.get_doc("Job", job)._apply_job_advances(doc)
