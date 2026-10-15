# Copyright (c) 2026, Kenz and contributors
# Tests for the SBM frontend API (jms/api/boot.py, job_state.py, jobs.py) and
# the Job rules it relies on.

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase

from jms.api import boot, job_state, jobs


def _job(status="Created", tasks=()):
	job = frappe.new_doc("Job")
	job.status = status
	for row in tasks:
		job.append("tasks", {"task_name": row.get("task_name", "Task"), **row})
	return job


class TestStage(FrappeTestCase):
	def test_stage_order(self):
		stage = job_state.get_stage
		self.assertEqual(stage("Cancelled", True, True, 0, 0), "Cancelled")
		self.assertEqual(stage("In Progress", False, False, 0, 0), "Processing Work")
		self.assertEqual(stage("Completed", True, False, 0, 0), "Invoice Pending")
		self.assertEqual(stage("Completed", True, True, 10, 5), "Amount Pending")
		self.assertEqual(stage("Completed", True, True, 0, 5), "Exp Pending")
		self.assertEqual(stage("Closed", True, True, 0, 0), "Completed")


class TestActions(FrappeTestCase):
	"""Same buttons and conditions as the Create menu of the ERPNext Job form."""

	def test_always_there_in_erpnext_order(self):
		self.assertEqual(
			job_state.get_actions(_job()),
			["advance_receipt", "payment_return", "sales_invoice", "expense", "expense_return", "close", "cancel"],
		)

	def test_cancelled_job_still_has_money_actions(self):
		actions = job_state.get_actions(_job("Cancelled"))
		self.assertIn("advance_receipt", actions)
		self.assertNotIn("close", actions)
		self.assertNotIn("cancel", actions)

	def test_outsource_actions(self):
		job = _job(tasks=[{"employee__outsource": "Outsource"}])
		self.assertIn("purchase_invoice", job_state.get_actions(job))
		self.assertNotIn("outsource_advance", job_state.get_actions(job))
		job.tasks[0].outsource_supplier = "Sup"
		job.tasks[0].purchase_invoice = "PI-1"
		actions = job_state.get_actions(job)
		self.assertIn("outsource_advance", actions)
		self.assertIn("purchase_invoice", actions)  # shown even when billed, like ERPNext
		self.assertEqual(actions[0], "outsource_advance")

	def test_close_and_cancel(self):
		completed = job_state.get_actions(_job("Completed"))
		self.assertIn("close", completed)
		self.assertNotIn("cancel", completed)
		self.assertNotIn("close", job_state.get_actions(_job("Closed")))

	def test_every_action_has_a_known_key(self):
		job = _job(tasks=[{"employee__outsource": "Outsource", "outsource_supplier": "Sup"}])
		for key in job_state.get_actions(job):
			self.assertIn(key, job_state.ACTION_METHODS)

	def test_next_action(self):
		nxt = job_state.get_next_action
		self.assertEqual(nxt("Processing Work", []), "tasks")
		self.assertEqual(nxt("Invoice Pending", ["sales_invoice"]), "sales_invoice")
		self.assertEqual(nxt("Amount Pending", ["advance_receipt"]), "advance_receipt")
		self.assertEqual(nxt("Completed", ["close"]), "close")
		self.assertEqual(nxt("Completed", ["purchase_invoice", "close"], unbilled_outsource=True), "purchase_invoice")
		self.assertEqual(nxt("Completed", ["purchase_invoice", "close"]), "close")
		self.assertIsNone(nxt("Cancelled", [], "Cancelled"))
		self.assertIsNone(nxt("Completed", ["purchase_invoice"], "Closed", True))


class TestStatusFromTasks(FrappeTestCase):
	def test_all_completed(self):
		job = _job("In Progress", [{"status": "Completed"}, {"status": "Completed"}])
		job.set_status_from_tasks()
		self.assertEqual(job.status, "Completed")
		self.assertTrue(job.completion_date)

	def test_all_in_progress(self):
		job = _job("Created", [{"status": "In Progress"}])
		job.set_status_from_tasks()
		self.assertEqual(job.status, "In Progress")

	def test_mixed_and_locked_are_kept(self):
		job = _job("Created", [{"status": "Completed"}, {"status": "Open"}])
		job.set_status_from_tasks()
		self.assertEqual(job.status, "Created")
		job = _job("Closed", [{"status": "In Progress"}])
		job.set_status_from_tasks()
		self.assertEqual(job.status, "Closed")


class TestPermissions(FrappeTestCase):
	def tearDown(self):
		frappe.set_user("Administrator")

	def test_non_office_user_is_blocked(self):
		frappe.set_user("Guest")
		self.assertRaises(frappe.PermissionError, jobs.list_jobs)
		self.assertRaises(frappe.PermissionError, job_state.get_job_state, "any")
		self.assertRaises(frappe.PermissionError, _job().get_financials)


class TestBootAndList(FrappeTestCase):
	def test_boot_for_office_user(self):
		# no HTTP session in tests, so the dev-mode CSRF token is stubbed
		with patch("jms.api.boot.get_csrf_token", return_value="token"):
			data = boot.get_boot()
		self.assertTrue(data["is_office"])
		self.assertFalse(data["is_task_staff"])
		self.assertIn("settings", data)

	def test_list_shape(self):
		data = jobs.list_jobs(page_length=5)
		self.assertLessEqual(len(data["jobs"]), 5)
		self.assertEqual(data["tab_counts"]["All"], sum(
			1 for _ in frappe.get_all("Job", pluck="name")
		))
		for job in data["jobs"]:
			self.assertIn(job["stage"], (*jobs.TABS, "Completed", *job_state.DEAD_STATUSES))

	def test_tab_filter(self):
		data = jobs.list_jobs(tab="Invoice Pending", page_length=100)
		self.assertTrue(all(j["stage"] == "Invoice Pending" for j in data["jobs"]))
		self.assertEqual(data["total"], data["tab_counts"]["Invoice Pending"])

	def test_bad_tab(self):
		self.assertRaises(frappe.ValidationError, jobs.list_jobs, tab="Bogus")


class TestDashboard(FrappeTestCase):
	def test_shape_and_consistency(self):
		from jms.api import home

		data = home.get_dashboard()
		self.assertEqual([s["label"] for s in data["lifecycle"]], list(home.LIFECYCLE))
		self.assertEqual([s["label"] for s in data["stages"]], list(home.STAGES))
		stage = {s["label"]: s["count"] for s in data["stages"]}
		self.assertEqual(data["to_invoice"]["total"], stage["Invoice Pending"])
		self.assertEqual(data["to_collect"]["total"], stage["Amount Pending"])
		for key in ("to_invoice", "to_collect", "overdue"):
			self.assertLessEqual(len(data[key]["rows"]), home.LIST_LENGTH)
			self.assertTrue(all(r["status"] != "Closed" for r in data[key]["rows"]))
		self.assertGreaterEqual(data["to_collect"]["amount"], sum(r["to_collect"] for r in data["to_collect"]["rows"]))
		self.assertIsNone(data["overdue"]["amount"])
		amounts = [r["to_collect"] for r in data["to_collect"]["rows"]]
		self.assertEqual(amounts, sorted(amounts, reverse=True))
		self.assertTrue(all(m["key"] in home.MONEY_FLAGS for m in data["money"]))

	def test_blocked_for_non_office_user(self):
		from jms.api import home

		frappe.set_user("Guest")
		try:
			self.assertRaises(frappe.PermissionError, home.get_dashboard)
		finally:
			frappe.set_user("Administrator")


class TestDashboardMoney(FrappeTestCase):
	def test_totals_match_job_forms(self):
		"""Dashboard totals = the same figures added up over every Job form."""
		from jms.api import home

		company = frappe.db.get_value("Job", {}, "company")
		if not company:
			self.skipTest("no jobs on this site")
		jobs = frappe.get_all("Job", filters={"company": company}, pluck="name", limit=0)
		if len(jobs) > 2000:
			self.skipTest("too many jobs to add up in a test")
		live = frappe.get_all(
			"Job", filters={"company": company, "status": ["not in", ["Cancelled", "Rejected"]]}, pluck="name"
		)
		forms = {}
		for j in live:
			for m in frappe.get_doc("Job", j).get_financials()["metrics"]:
				forms[m["key"]] = forms.get(m["key"], 0) + m["value"]
		money = {m["key"]: m["value"] for m in home.get_dashboard(company=company)["money"]}
		# Still to Receive differs on purpose: invoiced only, the Job form adds unbilled jobs.
		for key in ("total_job_amount", "total_received", "total_expenses", "outsourcing_cost", "net_profit"):
			if key in money:
				self.assertAlmostEqual(money[key], forms[key], places=2, msg=key)


class TestTrends(FrappeTestCase):
	def test_six_months_and_matching_totals(self):
		from frappe.utils import getdate, nowdate

		from jms.api import trends

		rows = trends.monthly()
		self.assertEqual(len(rows), trends.MONTHS)
		self.assertEqual(rows[-1]["month"], getdate(nowdate()).strftime("%Y-%m"))
		first = rows[0]["month"] + "-01"
		self.assertEqual(sum(r["jobs"] for r in rows), frappe.db.count("Job", {"date": [">=", first]}))
		self.assertIsNone(trends.monthly(show_money=False)[0]["received"])


class TestMyTasks(FrappeTestCase):
	def _task(self):
		row = frappe.db.sql(
			"""SELECT t.name, t.status FROM `tabJob Task` t JOIN `tabJob` j ON j.name = t.parent
			WHERE t.parenttype = 'Job' AND j.status NOT IN ('Closed', 'Cancelled', 'Rejected')
			AND t.status IN ('Open', 'In Progress') LIMIT 1""",
			as_dict=True,
		)
		if not row:
			self.skipTest("no open task on this site")
		return row[0]

	def test_office_user_sees_all_tasks(self):
		from jms.api import tasks

		data = tasks.my_tasks()
		self.assertEqual(data["scope"], "all")
		expected = frappe.db.sql(
			"""SELECT COUNT(*) FROM `tabJob Task` t JOIN `tabJob` j ON j.name = t.parent
			WHERE t.parenttype = 'Job' AND j.status NOT IN ('Cancelled', 'Rejected', 'Closed')
			AND t.status IN ('Open', 'In Progress', 'Pending')"""
		)[0][0]
		self.assertEqual(sum(t.status != "Completed" for t in data["tasks"]), expected)
		emp = next((t.assigned_to for t in data["tasks"] if t.assigned_to), None)
		if emp:
			self.assertTrue(all(t.assigned_to == emp for t in tasks.my_tasks(emp)["tasks"]))

	def test_task_staff_without_employee(self):
		from jms.api import tasks

		frappe.set_user("Guest")  # not an office user and linked to no Employee
		try:
			self.assertEqual(tasks.my_tasks(), {"scope": "mine", "has_employee": False, "tasks": []})
		finally:
			frappe.set_user("Administrator")

	def test_rules(self):
		from jms.api import tasks

		t = self._task()
		self.assertRaises(frappe.ValidationError, tasks.set_task_status, t.name, "Bogus")
		self.assertRaises(frappe.ValidationError, tasks.set_task_status, t.name, "Pending", "  ")
		self.assertRaises(frappe.DoesNotExistError, tasks.set_task_status, "nope", "Open")

	def test_change_is_saved_then_rolled_back(self):
		from jms.api import tasks

		t = self._task()
		try:
			res = tasks.set_task_status(t.name, "Pending", "Waiting for passport")
			self.assertEqual(res["status"], "Pending")
			row = frappe.db.get_value("Job Task", t.name, ["status", "pending_reason"], as_dict=True)
			self.assertEqual((row.status, row.pending_reason), ("Pending", "Waiting for passport"))
		finally:
			frappe.db.rollback()
		self.assertEqual(frappe.db.get_value("Job Task", t.name, "status"), t.status)
