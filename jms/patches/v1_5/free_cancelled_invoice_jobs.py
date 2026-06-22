# Copyright (c) 2026, Kenz and contributors
# Free any Job whose invoice "slot" is stale so a new invoice can be created and
# the old one (if any) deleted. Covers BOTH cases the earlier v1_3 missed:
#   - the linked invoice was CANCELLED (docstatus 2), and
#   - the linked invoice was DELETED outright (row gone, but the Job still
#     carries linked_invoice / sales_invoice_status = "Created").
# A Job's SI slot is "stale" when it has no ACTIVE (submitted) Sales Invoice.
# Idempotent; safe to re-run.

import frappe


def execute():
	if not frappe.db.table_exists("Job"):
		return

	# --- Sales Invoice slot: clear if no submitted SI is tagged to the job ---
	for r in frappe.db.sql(
		"""
		SELECT j.name FROM `tabJob` j
		WHERE (
				(j.linked_invoice IS NOT NULL AND j.linked_invoice != '')
				OR j.sales_invoice_status = 'Created'
			)
		  AND NOT EXISTS (
				SELECT 1 FROM `tabSales Invoice` si
				WHERE si.job = j.name AND si.docstatus = 1
			)
		""",
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

	# --- Purchase Invoice slot: the back-ref points at one outsource PI; clear
	# it if that PI is no longer active (cancelled or deleted). Expense PIs never
	# set this back-ref, so they are unaffected. ---
	for r in frappe.db.sql(
		"""
		SELECT j.name FROM `tabJob` j
		WHERE (j.purchase_invoice IS NOT NULL AND j.purchase_invoice != '')
		  AND NOT EXISTS (
				SELECT 1 FROM `tabPurchase Invoice` pi
				WHERE pi.name = j.purchase_invoice AND pi.docstatus = 1
			)
		""",
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
