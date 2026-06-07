# Copyright (c) 2025, sammish and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase

from jms.patches.v1_2.repair_naming_series import _TRAILING_NUM


def _any_company():
	"""A real company to exercise company-dependent reads, or None.

	Dynamic: never hardcodes a site-specific company, so these tests run on
	any site (restored copy or a fresh test site)."""
	return (
		frappe.defaults.get_user_default("company")
		or frappe.db.get_single_value("Global Defaults", "default_company")
		or frappe.db.get_value("Company", {}, "name")
	)


class TestResolveCompany(FrappeTestCase):
	"""Job._resolve_company picks the document's own company first so that
	creating sub-documents does not depend on the logged-in user's default."""

	def test_prefers_job_own_company(self):
		job = frappe.new_doc("Job")
		job.company = "__Test JMS Company"
		self.assertEqual(job._resolve_company(), "__Test JMS Company")

	def test_falls_back_to_defaults_when_no_company(self):
		job = frappe.new_doc("Job")
		job.company = None
		expected = (
			frappe.defaults.get_user_default("company")
			or frappe.db.get_single_value("Global Defaults", "default_company")
		)
		self.assertEqual(job._resolve_company(), expected)


class TestJobFinancialsContract(FrappeTestCase):
	"""get_financials returns a stable contract; a job with no posted GL /
	payments / invoices reports every metric as zero (and never crashes)."""

	EXPECTED_KEYS = {
		"total_job_amount",
		"total_received",
		"outstanding",
		"total_expenses",
		"outsourcing_cost",
		"paid_out",
		"net_profit",
		"profit_balance",
	}

	def test_zero_state_contract(self):
		company = _any_company()
		if not company:
			self.skipTest("no Company on this site to exercise get_financials")

		job = frappe.new_doc("Job")
		job.company = company
		data = job.get_financials()

		# top-level shape
		self.assertIn("currency", data)
		self.assertIn("metrics", data)
		self.assertIn("indicators", data)

		metrics = data["metrics"]
		self.assertEqual(len(metrics), 8)
		self.assertEqual({m["key"] for m in metrics}, self.EXPECTED_KEYS)

		# an unposted job has nothing in the GL → every metric is zero
		for m in metrics:
			self.assertIn("label", m)
			self.assertIn("visible", m)
			self.assertEqual(
				m["value"], 0.0, msg=f"{m['key']} should be 0 for an unposted job"
			)

		# no receipts → no agent/customer split, no pending indicators
		self.assertEqual(data["received_from_customer"], 0.0)
		self.assertEqual(data["received_from_agent"], 0.0)
		self.assertFalse(data["indicators"]["amount_pending"])
		self.assertFalse(data["indicators"]["exp_pending"])


class TestNamingSeriesRepairParsing(FrappeTestCase):
	"""The naming-series repair derives (prefix, number) from existing
	document names to bump tabSeries.current. These cover that parser — the
	logic the DuplicateEntryError fix depends on."""

	def test_parses_standard_series_name(self):
		m = _TRAILING_NUM.match("ACC-PINV-2026-00005")
		self.assertIsNotNone(m)
		self.assertEqual(m.group(1), "ACC-PINV-2026-")
		self.assertEqual(int(m.group(2)), 5)

	def test_amendment_name_yields_its_own_prefix(self):
		# Amendment names like "SI-00025-1" parse to a bogus prefix; the repair
		# only ever updates series rows that already exist, so this never
		# creates a wrong series.
		m = _TRAILING_NUM.match("SI-00025-1")
		self.assertIsNotNone(m)
		self.assertEqual(m.group(1), "SI-00025-")
		self.assertEqual(int(m.group(2)), 1)

	def test_name_without_trailing_digits_does_not_match(self):
		self.assertIsNone(_TRAILING_NUM.match("NO-DIGITS-HERE"))
