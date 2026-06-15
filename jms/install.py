# Copyright (c) 2026, Kenz and contributors
# For license information, please see license.txt

import frappe


def before_tests():
	"""Bootstrap the standard ERPNext test masters before JMS tests run.

	`bench run-tests --app jms` only runs JMS's own ``before_tests`` hook
	(Frappe scopes the hook to the app under test), so ERPNext's test setup
	never executes. And on a restored production database real companies
	already exist, so even ERPNext's own ``before_tests`` would skip creating
	its standard ``_Test Company``. Without that company the auto-built
	ERPNext test records (Cost Center, etc.) fail their autoname with a
	``None`` company abbreviation.

	Create ``_Test Company`` here, idempotently. Test-only and safe to re-run.
	"""
	if not frappe.flags.in_test:
		return

	if not frappe.db.exists("Company", "_Test Company"):
		frappe.get_doc(
			{
				"doctype": "Company",
				"company_name": "_Test Company",
				"abbr": "_TC",
				"default_currency": "INR",
				"country": "India",
			}
		).insert(ignore_permissions=True, ignore_if_duplicate=True)

	frappe.db.commit()
