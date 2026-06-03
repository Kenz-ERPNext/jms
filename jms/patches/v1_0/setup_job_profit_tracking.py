# Copyright (c) 2026, Kenz and contributors
# Phase 1 of Job Profit & Payment Tracking:
#   1. Create a dedicated "Outsourcing Cost" expense account per company
#      (under Direct Expenses) so outsourcing splits cleanly from general
#      expenses in the GL / profit reports.
#   2. Relax the "Job" accounting dimension so non-job postings are not
#      blocked: turn OFF "Mandatory For Balance Sheet" (keep P&L mandatory).
# Idempotent — safe to re-run.

import frappe

OUTSOURCING_ACCOUNT_NAME = "Outsourcing Cost"
PREFERRED_NUMBER = "5120"


def execute():
	for company in frappe.get_all("Company", pluck="name"):
		create_outsourcing_cost_account(company)
	relax_job_dimension_balance_sheet()


def create_outsourcing_cost_account(company):
	"""Create the Outsourcing Cost ledger under Direct Expenses if missing."""
	existing = frappe.db.get_value(
		"Account",
		{"account_name": OUTSOURCING_ACCOUNT_NAME, "company": company},
		"name",
	)
	if existing:
		return existing

	parent = frappe.db.get_value(
		"Account",
		{"account_name": "Direct Expenses", "company": company, "is_group": 1},
		"name",
	) or frappe.db.get_value(
		"Account",
		{"account_name": "Expenses", "company": company, "is_group": 1},
		"name",
	)
	if not parent:
		frappe.log_error(
			f"No Direct Expenses/Expenses parent found for company {company}; "
			f"skipped Outsourcing Cost account.",
			"JMS Job Profit setup",
		)
		return None

	number = PREFERRED_NUMBER
	if frappe.db.get_value("Account", {"account_number": number, "company": company}):
		number = None  # avoid clashing with an existing account number

	account = frappe.get_doc(
		{
			"doctype": "Account",
			"account_name": OUTSOURCING_ACCOUNT_NAME,
			"account_number": number,
			"parent_account": parent,
			"company": company,
			"root_type": "Expense",
			"report_type": "Profit and Loss",
			"is_group": 0,
		}
	)
	account.insert(ignore_permissions=True)
	return account.name


def relax_job_dimension_balance_sheet():
	"""Turn off Mandatory-For-Balance-Sheet on the Job dimension defaults."""
	if not frappe.db.exists("Accounting Dimension", "Job"):
		return

	dimension = frappe.get_doc("Accounting Dimension", "Job")
	changed = False
	for row in dimension.get("dimension_defaults", []):
		if row.mandatory_for_bs:
			row.mandatory_for_bs = 0
			changed = True
	if changed:
		dimension.save(ignore_permissions=True)
