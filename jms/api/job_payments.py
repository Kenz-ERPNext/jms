# Copyright (c) 2026, Kenz and contributors
# Which Jobs have which kind of document from the Job's Create buttons, for the
# "Payments" filter on the Jobs list. The buttons leave no mark on the documents, so
# the kind is read from ERPNext's own fields (submitted documents only):
#   Invoice                    a Sales Invoice of the Job
#   Advance Receipt            Receive from a Customer, not against a Sales Invoice
#   Payment Return             Pay to a Customer
#   Expense                    a Purchase Invoice of the Job that no outsourced task bills
#   Expense Return             Receive from a Supplier
#   Outsource Advance Payment  Pay to a Supplier, not against a Purchase Invoice
# (Invoice & Payment and expense payments are always against their invoice.)

import frappe

PAYMENTS = {
	"advance_receipt": ("Receive", "Customer", "Sales Invoice"),
	"payment_return": ("Pay", "Customer", None),
	"expense_return": ("Receive", "Supplier", None),
	"outsource_advance": ("Pay", "Supplier", "Purchase Invoice"),
}
KINDS = ("invoice", "advance_receipt", "payment_return", "expense", "expense_return", "outsource_advance")


def _job_column(doctype, alias):
	"""The document's Job: the accounting dimension, else the custom field."""
	has_dim = frappe.db.has_column(doctype, "job")
	has_custom = frappe.db.has_column(doctype, "custom_job")
	if has_dim and has_custom:
		return f"IFNULL(NULLIF({alias}.job, ''), {alias}.custom_job)"
	return f"{alias}.job" if has_dim else f"{alias}.custom_job"


def _jobs(sql, params):
	return {r[0] for r in frappe.db.sql(sql, params)}


def jobs_by_kind(job_names):
	"""{kind: set of those jobs that have at least one document of that kind}."""
	if not job_names:
		return {kind: set() for kind in KINDS}
	jobs = tuple(job_names)
	result = {}

	si = _job_column("Sales Invoice", "si")
	result["invoice"] = _jobs(
		f"SELECT DISTINCT {si} FROM `tabSales Invoice` si WHERE si.docstatus = 1 AND {si} IN %(jobs)s",
		{"jobs": jobs},
	)
	pi = _job_column("Purchase Invoice", "pi")
	result["expense"] = _jobs(
		f"""SELECT DISTINCT {pi} FROM `tabPurchase Invoice` pi
			WHERE pi.docstatus = 1 AND {pi} IN %(jobs)s
				AND NOT EXISTS (SELECT 1 FROM `tabJob Task` t WHERE t.purchase_invoice = pi.name)""",
		{"jobs": jobs},
	)
	pe = _job_column("Payment Entry", "pe")
	for kind, (payment_type, party_type, invoice) in PAYMENTS.items():
		not_against = (
			"""AND NOT EXISTS (SELECT 1 FROM `tabPayment Entry Reference` r
				WHERE r.parent = pe.name AND r.reference_doctype = %(invoice)s)"""
			if invoice
			else ""
		)
		result[kind] = _jobs(
			f"""SELECT DISTINCT {pe} FROM `tabPayment Entry` pe
				WHERE pe.docstatus = 1 AND pe.payment_type = %(type)s AND pe.party_type = %(party)s
					AND {pe} IN %(jobs)s {not_against}""",
			{"type": payment_type, "party": party_type, "invoice": invoice, "jobs": jobs},
		)
	return {kind: result[kind] for kind in KINDS}
