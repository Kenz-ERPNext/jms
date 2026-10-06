# Copyright (c) 2026, sammish and Contributors
# See license.txt

import json

import frappe
from frappe.tests.utils import FrappeTestCase

from jms.events import log_cancelled_document


class TestCancelledDocument(FrappeTestCase):
	def rows(self, name):
		return frappe.get_all(
			"Cancelled Document", filters={"cancelled_name": name}, fields=["name", "cancelled_doctype", "cancelled_by", "data"]
		)

	def new_task(self, **kwargs):
		return frappe.get_doc({"doctype": "Task", "subject": "Cancelled Document test", **kwargs}).insert()

	def test_status_cancelled_is_logged_once_with_a_copy_of_the_record(self):
		task = self.new_task()
		self.assertEqual(self.rows(task.name), [])

		task.status = "Cancelled"
		task.save()
		rows = self.rows(task.name)
		self.assertEqual(len(rows), 1)
		self.assertEqual(rows[0].cancelled_doctype, "Task")
		self.assertEqual(rows[0].cancelled_by, frappe.session.user)
		self.assertEqual(json.loads(rows[0].data)["status"], "Cancelled")

		# saving again without a status change must not log it again
		task.reload()
		task.subject = "changed"
		task.save()
		self.assertEqual(len(self.rows(task.name)), 1)

	def test_other_status_changes_are_not_logged(self):
		task = self.new_task()
		task.status = "Working"
		task.save()
		self.assertEqual(self.rows(task.name), [])

	def test_on_cancel_is_logged(self):
		task = self.new_task()
		log_cancelled_document(task, "on_cancel")
		self.assertEqual(len(self.rows(task.name)), 1)

	def test_cancelled_document_does_not_log_itself(self):
		task = self.new_task(status="Cancelled")
		log = frappe.get_doc("Cancelled Document", self.rows(task.name)[0].name)
		log_cancelled_document(log, "on_cancel")
		self.assertEqual(self.rows(log.name), [])
