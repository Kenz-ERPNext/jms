# Copyright (c) 2026, Kenz and contributors

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import nowdate

from jms import api


def _first(doctype, filters=None):
	rows = frappe.get_all(doctype, filters=filters or {}, pluck="name", limit=1)
	return rows[0] if rows else None


class TestDashboardApi(FrappeTestCase):
	def setUp(self):
		frappe.set_user("Administrator")

	def tearDown(self):
		frappe.set_user("Administrator")

	def make_job(self):
		company, customer, job_type = _first("Company"), _first("Customer"), _first("Job Type")
		if not all([company, customer, job_type]):
			self.skipTest("missing company/customer/job type")
		job = frappe.new_doc("Job")
		job.job_title = "testctl dashboard api job"
		job.date = job.start_date = nowdate()
		job.status = "Created"
		job.job_type = job_type
		job.receivable_from = "Customer"
		job.customer = customer
		job.company = company
		job.append("tasks", {"task_name": "open task", "status": "Open", "employee__outsource": "Employee"})
		job.append(
			"tasks",
			{"task_name": "pending task", "status": "Pending", "pending_reason": "Waiting for client",
				"employee__outsource": "Employee"},
		)
		job.insert(ignore_permissions=True)
		return job

	def test_only_admin_roles_can_call(self):
		frappe.set_user("Guest")
		for call in (
			api.task_status_counts,
			api.job_cards,
			lambda: api.job_tasks("any"),
		):
			with self.assertRaises(frappe.PermissionError):
				call()

	def test_counts_add_up(self):
		counts = api.task_status_counts()
		self.assertEqual(
			counts["all"],
			sum(counts[k] for k in ("open", "in_progress", "pending", "completed", "cancelled")),
		)
		self.assertEqual(
			counts["all"], frappe.db.count("Job Task", {"parenttype": "Job"})
		)

	def test_job_card_has_task_counts(self):
		job = self.make_job()
		result = api.job_cards(search=job.name)
		card = next(j for j in result["jobs"] if j.name == job.name)
		self.assertEqual(card.task_total, 2)
		self.assertEqual((card.open, card.pending, card.completed), (1, 1, 0))
		self.assertEqual(result["total"], len(result["jobs"]))

	def test_status_filter_keeps_only_jobs_with_that_status(self):
		job = self.make_job()
		pending = api.job_cards(status="Pending", search=job.name)
		self.assertEqual([j.name for j in pending["jobs"]], [job.name])
		completed = api.job_cards(status="Completed", search=job.name)
		self.assertEqual(completed["jobs"], [])
		self.assertEqual(completed["total"], 0)

	def test_invalid_status_is_refused(self):
		with self.assertRaises(frappe.ValidationError):
			api.job_cards(status="Bogus")

	def test_pagination(self):
		self.make_job()
		first = api.job_cards(page_length=1)
		self.assertEqual(len(first["jobs"]), 1)
		self.assertGreaterEqual(first["total"], 1)

	def test_job_tasks_shows_pending_reason(self):
		job = self.make_job()
		data = api.job_tasks(job.name)
		self.assertEqual(data["job"].name, job.name)
		pending = next(t for t in data["tasks"] if t.status == "Pending")
		self.assertEqual(pending.pending_reason, "Waiting for client")
		self.assertIsInstance(data["history"], list)

	def test_history_is_a_readable_timeline(self):
		job = self.make_job()
		job.reload()
		job.tasks[0].status = "Pending"
		job.tasks[0].pending_reason = "Client away"
		job.save(ignore_permissions=True)

		events = api.job_tasks(job.name)["history"]
		status = next(e for e in events if e.kind == "status")
		self.assertEqual(status.task, "open task")
		self.assertEqual(status.field_label, "Status")
		self.assertEqual((status.old, status.new), ("Open", "Pending"))
		self.assertEqual(status.reason, "Client away")
		self.assertEqual(status.actor, frappe.session.user)
		# the Pending Reason row of the same save is folded into the status event
		self.assertFalse(any(e.field == "pending_reason" and e.task == "open task" for e in events))

	def test_update_task_status_moves_the_task(self):
		job = self.make_job()
		task = job.tasks[0]
		api.update_task_status(task.name, "In Progress")
		self.assertEqual(frappe.db.get_value("Job Task", task.name, "status"), "In Progress")

		api.update_task_status(task.name, "Completed")
		status, done = frappe.db.get_value("Job Task", task.name, ["status", "completion_date"])
		self.assertEqual(status, "Completed")
		self.assertIsNotNone(done)

	def test_update_task_status_to_pending_needs_a_reason(self):
		job = self.make_job()
		task = job.tasks[0]
		with self.assertRaises(frappe.ValidationError):
			api.update_task_status(task.name, "Pending")
		api.update_task_status(task.name, "Pending", "Waiting for passport")
		self.assertEqual(
			frappe.db.get_value("Job Task", task.name, ["status", "pending_reason"]),
			("Pending", "Waiting for passport"),
		)
		# leaving Pending clears the reason
		api.update_task_status(task.name, "Open")
		self.assertIsNone(frappe.db.get_value("Job Task", task.name, "pending_reason"))

	def test_update_task_status_is_admin_only(self):
		job = self.make_job()
		frappe.set_user("Guest")
		with self.assertRaises(frappe.PermissionError):
			api.update_task_status(job.tasks[0].name, "Completed")

	def test_job_tasks_unknown_job(self):
		with self.assertRaises(frappe.DoesNotExistError):
			api.job_tasks("JOB-DOES-NOT-EXIST")
