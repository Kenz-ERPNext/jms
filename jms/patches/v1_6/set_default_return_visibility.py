# Copyright (c) 2026, Kenz and contributors
# Migrating the new "Show Expense Returns" / "Show Payment Returns" Check
# fields onto the existing JMS Settings singleton doesn't backfill their "1"
# default — a Single doctype's new field simply has no stored value (reads
# back as 0), not the JSON schema default. Explicitly turn them on for
# existing sites, matching every other "show_*" profit-metric toggle, which
# all default visible. Idempotent — safe to re-run.

import frappe


def execute():
	if not frappe.db.exists("DocType", "JMS Settings"):
		return

	settings = frappe.get_single("JMS Settings")
	changed = False

	if not settings.get("show_expense_returns"):
		settings.show_expense_returns = 1
		changed = True

	if not settings.get("show_payment_returns"):
		settings.show_payment_returns = 1
		changed = True

	if changed:
		settings.save(ignore_permissions=True)
