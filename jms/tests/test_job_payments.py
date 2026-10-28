# Copyright (c) 2026, Kenz and contributors
# The "Payments" filter of the Jobs list: Jobs with a given kind of payment.

import frappe
from frappe.tests.utils import FrappeTestCase

from jms.api import jobs
from jms.api.job_payments import KINDS


class TestJobPayments(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def test_counts_match_the_filtered_list(self):
		counts = jobs.list_jobs(page_length=100)["payment_counts"]
		self.assertEqual(set(counts), set(KINDS))
		for kind, n in counts.items():
			self.assertEqual(jobs.list_jobs(payment=kind, page_length=100)["total"], n, kind)

	def test_unknown_kind_is_refused(self):
		self.assertRaises(frappe.ValidationError, jobs.list_jobs, payment="gift")
