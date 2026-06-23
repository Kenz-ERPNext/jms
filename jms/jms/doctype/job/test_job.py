# Copyright (c) 2025, sammish and Contributors
# See license.txt

import frappe
from frappe.utils import nowdate
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


def _first(doctype, filters=None):
	rows = frappe.get_all(doctype, filters=filters or {}, pluck="name", limit=1)
	return rows[0] if rows else None


class TestJobFinancialsNumbers(FrappeTestCase):
	"""Numeric end-to-end check of get_financials against self-built documents
	(reuses existing masters — never creates a Company, which would re-trigger
	ERPNext's Cost Center fixture autoname). All docs are rolled back by
	FrappeTestCase. Profit Balance = SI outstanding - PI outstanding; Paid Out =
	submitted 'Pay' Payment Entries for the job."""

	def _make_job(self, company, customer):
		job = frappe.new_doc("Job")
		job.job_title = "testctl numeric job"
		job.date = nowdate()
		job.start_date = nowdate()
		job.status = "Created"
		job.job_type = _first("Job Type")
		job.receivable_from = "Customer"
		job.customer = customer
		job.company = company
		job.insert(ignore_permissions=True)
		return job

	def test_profit_balance_1000_and_paid_out_500(self):
		company = _first("Company")
		customer = _first("Customer")
		supplier = _first("Supplier")
		item = _first("Item", {"is_stock_item": 0})
		job_type = _first("Job Type")
		if not all([company, customer, supplier, item, job_type]):
			self.skipTest("missing a required master (company/customer/supplier/service item/job type)")

		cash = frappe.get_cached_value("Company", company, "default_cash_account") \
			or frappe.get_cached_value("Company", company, "default_bank_account")
		payable = frappe.get_cached_value("Company", company, "default_payable_account")
		if not (cash and payable):
			self.skipTest("company has no default cash/bank or payable account")

		job = self._make_job(company, customer)

		# Sales Invoice with outstanding 1000 (one line, rate 1000, no tax) → profit_balance = 1000
		si = frappe.new_doc("Sales Invoice")
		si.customer = customer
		si.company = company
		si.due_date = nowdate()
		si.append("items", {"item_code": item, "qty": 1, "rate": 1000})
		si.set("job", job.name)
		si.insert(ignore_permissions=True)
		si.submit()

		# Payment Entry, Pay 500, tagged to the job → paid_out = 500
		pe = frappe.new_doc("Payment Entry")
		pe.payment_type = "Pay"
		pe.company = company
		pe.party_type = "Supplier"
		pe.party = supplier
		pe.paid_from = cash
		pe.paid_to = payable
		pe.paid_amount = 500
		pe.received_amount = 500
		pe.set("job", job.name)
		pe.insert(ignore_permissions=True)
		pe.submit()

		fin = job.get_financials()
		metrics = {m["key"]: m["value"] for m in fin["metrics"]}
		self.assertEqual(metrics["profit_balance"], 1000.0)
		self.assertEqual(metrics["paid_out"], 500.0)


def _non_bank_mode_of_payment(company):
	"""A Mode of Payment that has an account for `company` and is not Bank type
	(so no reference no/date is required), or None."""
	for r in frappe.get_all(
		"Mode of Payment Account", filters={"company": company}, fields=["parent"], limit=20
	):
		if frappe.db.get_value("Mode of Payment", r.parent, "type") != "Bank":
			return r.parent
	return None


class TestJobAdvances(FrappeTestCase):
	"""Contract tests for the advance helpers: each creates a SUBMITTED Payment
	Entry of the right type/party/amount, tagged to the job. (Reconciliation
	amounts are out of scope — this just protects the creation contract.)
	All docs roll back; reuses existing masters, never creates a Company."""

	def _job(self, company, customer):
		job = frappe.new_doc("Job")
		job.job_title = "testctl advance job"
		job.date = nowdate()
		job.start_date = nowdate()
		job.status = "Created"
		job.job_type = _first("Job Type")
		job.receivable_from = "Customer"
		job.customer = customer
		job.company = company
		job.insert(ignore_permissions=True)
		return job

	def test_create_advance_receipt_makes_submitted_receive_pe(self):
		company = _first("Company")
		customer = _first("Customer")
		mop = _non_bank_mode_of_payment(company) if company else None
		if not all([company, customer, _first("Job Type"), mop]):
			self.skipTest("missing company/customer/job type or a non-bank Mode of Payment account")

		job = self._job(company, customer)
		pe_name = job.create_advance_receipt(25, mop)
		pe = frappe.get_doc("Payment Entry", pe_name)
		self.assertEqual(pe.docstatus, 1)
		self.assertEqual(pe.payment_type, "Receive")
		self.assertEqual(pe.party_type, "Customer")
		self.assertEqual(pe.party, customer)
		self.assertEqual(pe.get("job"), job.name)
		self.assertEqual(pe.paid_amount, 25)

	def test_create_outsource_advance_payment_makes_submitted_pay_pe(self):
		company = _first("Company")
		customer = _first("Customer")
		supplier = _first("Supplier")
		mop = _non_bank_mode_of_payment(company) if company else None
		if not all([company, customer, supplier, _first("Job Type"), mop]):
			self.skipTest("missing company/customer/supplier/job type or a non-bank Mode of Payment account")

		job = self._job(company, customer)
		names = job.create_outsource_advance_payment(
			[{"supplier": supplier, "advance_amount": 750}], mop
		)
		self.assertEqual(len(names), 1)
		pe = frappe.get_doc("Payment Entry", names[0])
		self.assertEqual(pe.docstatus, 1)
		self.assertEqual(pe.payment_type, "Pay")
		self.assertEqual(pe.party_type, "Supplier")
		self.assertEqual(pe.party, supplier)
		self.assertEqual(pe.get("job"), job.name)
		self.assertEqual(pe.paid_amount, 750)

	def test_advance_receipt_posts_to_selected_mode_account(self):
		"""Guards the bank-account fix: the receipt must land in the SELECTED
		Mode of Payment's account, not the company's default bank account."""
		company = _first("Company")
		customer = _first("Customer")
		mop = _non_bank_mode_of_payment(company) if company else None
		if not all([company, customer, _first("Job Type"), mop]):
			self.skipTest("missing company/customer/job type or a non-bank Mode of Payment account")

		mode_account = frappe.db.get_value(
			"Mode of Payment Account", {"parent": mop, "company": company}, "default_account"
		)
		job = self._job(company, customer)
		pe = frappe.get_doc("Payment Entry", job.create_advance_receipt(40, mop))
		self.assertEqual(pe.paid_to, mode_account)


class TestJobClosingRule(FrappeTestCase):
	"""The strict 'Closed' rule: a Job may close only when every task is
	Completed AND the full amount is received; closing_date is stamped on close
	and cleared on re-open. Reuses existing masters; all docs roll back."""

	def _job(self, company, customer, priced=False):
		job = frappe.new_doc("Job")
		job.job_title = "testctl closing job"
		job.date = nowdate()
		job.start_date = nowdate()
		job.status = "Created"
		job.job_type = _first("Job Type")
		job.receivable_from = "Customer"
		job.customer = customer
		job.company = company
		if priced:
			job.append("items", {
				"work_template": _first("Work Template"),
				"item_code": _first("Item", {"is_stock_item": 0}),
				"job_qty": 1,
				"fee_price": 1000,
			})
		job.append("tasks", {"task_name": "t1", "status": "Pending", "employee__outsource": "Employee"})
		job.insert(ignore_permissions=True)
		return job

	def test_block_close_when_tasks_pending(self):
		company, customer = _first("Company"), _first("Customer")
		if not all([company, customer, _first("Job Type")]):
			self.skipTest("missing company/customer/job type")
		job = self._job(company, customer)
		job.status = "Closed"
		self.assertRaises(frappe.ValidationError, job.save, ignore_permissions=True)

	def test_block_close_when_not_fully_paid(self):
		company, customer = _first("Company"), _first("Customer")
		item = _first("Item", {"is_stock_item": 0})
		if not all([company, customer, _first("Job Type"), item, _first("Work Template")]):
			self.skipTest("missing company/customer/job type/service item/work template")
		job = self._job(company, customer, priced=True)  # net_amount = 1000, unpaid
		for t in job.tasks:
			t.status = "Completed"
		job.status = "Closed"
		self.assertRaises(frappe.ValidationError, job.save, ignore_permissions=True)

	def test_close_succeeds_and_stamps_then_reopen_clears(self):
		company, customer = _first("Company"), _first("Customer")
		if not all([company, customer, _first("Job Type")]):
			self.skipTest("missing company/customer/job type")
		job = self._job(company, customer)  # no priced items → net_amount 0 → paid trivially
		for t in job.tasks:
			t.status = "Completed"
		job.status = "Closed"
		job.save(ignore_permissions=True)
		self.assertEqual(job.status, "Closed")
		self.assertTrue(job.closing_date, "closing_date must be stamped on close")
		# re-opening clears the recognition date
		job.status = "In Progress"
		job.save(ignore_permissions=True)
		self.assertFalse(job.closing_date)


class TestSbmReportsSmoke(FrappeTestCase):
	"""Every SBM management report executes without error and exposes its
	expected columns (run against whatever data the site has)."""

	REPORTS = {
		"jms.jms.report.closed_job_profit.closed_job_profit": {"name", "job_value", "cost", "profit", "closing_month"},
		"jms.jms.report.monthly_profit.monthly_profit": {"month", "jobs", "job_value", "cost", "profit"},
		"jms.jms.report.cash_collection.cash_collection": {"posting_date", "party", "job", "amount"},
		"jms.jms.report.work_in_progress.work_in_progress": {"name", "job_value", "received", "pending", "completion"},
		"jms.jms.report.pending_tasks.pending_tasks": {"job", "task_name", "status"},
		"jms.jms.report.outsourcing_pending_tasks.outsourcing_pending_tasks": {"job", "vendor", "task_cost"},
		"jms.jms.report.employee_task_report.employee_task_report": {"assigned_to", "job", "task_name"},
		"jms.jms.report.outstanding_receivable.outstanding_receivable": {"name", "job_value", "outstanding"},
		"jms.jms.report.job_status_report.job_status_report": {"name", "stage", "to_collect", "to_pay"},
	}

	def test_reports_execute_and_expose_columns(self):
		import importlib

		for mod, expected in self.REPORTS.items():
			report = importlib.import_module(mod)
			columns, data = report.execute({})
			colnames = {c["fieldname"] for c in columns}
			self.assertTrue(
				expected.issubset(colnames),
				msg=f"{mod}: missing columns {expected - colnames}",
			)
			self.assertIsInstance(data, list)
