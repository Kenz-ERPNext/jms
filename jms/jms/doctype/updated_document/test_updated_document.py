# Copyright (c) 2026, sammish and Contributors
# See license.txt

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import nowdate


def _first(doctype, filters=None):
	rows = frappe.get_all(doctype, filters=filters or {}, pluck="name", limit=1)
	return rows[0] if rows else None


class TestUpdatedDocument(FrappeTestCase):
	def rows(self, name):
		return frappe.get_all(
			"Updated Document",
			filters={"updated_name": name},
			fields=["updated_doctype", "updated_by", "job", "field_changed", "old_value", "new_value", "reason"],
			order_by="creation",
		)

	def new_task(self):
		return frappe.get_doc({"doctype": "Task", "subject": "Updated Document test"}).insert()

	def test_creating_or_saving_without_a_change_logs_nothing(self):
		task = self.new_task()
		self.assertEqual(self.rows(task.name), [])
		task.save()
		self.assertEqual(self.rows(task.name), [])

	def test_each_changed_field_gets_a_row_with_old_and_new_value(self):
		task = self.new_task()
		task.subject = "changed"
		task.priority = "High"
		task.save()

		by_field = {r.field_changed: r for r in self.rows(task.name)}
		self.assertEqual(set(by_field), {"subject", "priority"})
		self.assertEqual(by_field["subject"].old_value, "Updated Document test")
		self.assertEqual(by_field["subject"].new_value, "changed")
		self.assertEqual(by_field["priority"].new_value, "High")
		self.assertEqual(by_field["subject"].updated_by, frappe.session.user)

	def test_updated_document_does_not_log_itself(self):
		task = self.new_task()
		task.subject = "changed"
		task.save()
		row = frappe.get_all("Updated Document", filters={"updated_name": task.name}, pluck="name")[0]
		self.assertEqual(frappe.get_all("Updated Document", filters={"updated_name": row}), [])

	def test_setting_a_job_task_to_pending_stores_its_reason(self):
		company, customer, job_type = _first("Company"), _first("Customer"), _first("Job Type")
		if not all([company, customer, job_type]):
			self.skipTest("missing company/customer/job type")

		job = frappe.new_doc("Job")
		job.job_title = "testctl updated document job"
		job.date = job.start_date = nowdate()
		job.status = "Created"
		job.job_type = job_type
		job.receivable_from = "Customer"
		job.customer = customer
		job.company = company
		job.append("tasks", {"task_name": "t1", "status": "Open", "employee__outsource": "Employee"})
		job.insert(ignore_permissions=True)
		self.assertEqual(self.rows(job.name), [])

		job.tasks[0].status = "Pending"
		job.tasks[0].pending_reason = "Waiting for documents"
		job.save(ignore_permissions=True)

		status = [r for r in self.rows(job.name) if r.field_changed == "tasks › row 1 › status"][0]
		self.assertEqual((status.old_value, status.new_value), ("Open", "Pending"))
		self.assertEqual(status.reason, "Waiting for documents")
		self.assertEqual(status.job, job.name)
