# Copyright (c) 2026, sammish and Contributors
# See license.txt

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase
from frappe.utils import nowdate


def _first(doctype, filters=None):
	rows = frappe.get_all(doctype, filters=filters or {}, pluck="name", limit=1)
	return rows[0] if rows else None


class TestAccountingChangeLog(FrappeTestCase):
	def rows(self, name):
		return frappe.get_all(
			"Accounting Change Log",
			filters={"reference_name": name},
			fields=["action", "reference_doctype", "changed_by", "party", "amount", "summary", "details"],
			order_by="creation, modified",
		)

	def new_mode_of_payment(self):
		doc = frappe.get_doc(
			{"doctype": "Mode of Payment", "mode_of_payment": f"ACL test {frappe.generate_hash(length=6)}", "type": "Cash"}
		)
		# sites may add mandatory custom fields (e.g. ZATCA codes) that do not matter here
		doc.flags.ignore_mandatory = True
		return doc.insert()

	def test_create_edit_and_delete_are_logged_in_plain_language(self):
		mop = self.new_mode_of_payment()
		mop.type = "Bank"
		mop.save()
		mop.save()  # no change: nothing logged
		name = mop.name
		mop.delete()

		rows = self.rows(name)
		self.assertEqual([r.action for r in rows], ["Created", "Edited", "Deleted"])
		self.assertEqual(rows[1].details, "Type: Cash → Bank")
		self.assertIn(f"edited Mode of Payment {name}", rows[1].summary)
		self.assertEqual(rows[0].changed_by, frappe.session.user)

	def test_documents_outside_accounting_are_not_logged(self):
		task = frappe.get_doc({"doctype": "Task", "subject": "ACL test"}).insert()
		task.subject = "changed"
		task.save()
		self.assertEqual(self.rows(task.name), [])

	def test_new_entries_are_pushed_live_to_the_log_room(self):
		with patch("jms.accounting_log.frappe.publish_realtime") as publish:
			mop = self.new_mode_of_payment()
		calls = [c for c in publish.call_args_list if c.args[0] == "accounting_change_log"]
		self.assertEqual(len(calls), 1)
		args, kwargs = calls[0]
		self.assertEqual(args[0], "accounting_change_log")
		self.assertEqual(args[1]["reference_name"], mop.name)
		self.assertEqual(kwargs, {"doctype": "Accounting Change Log", "after_commit": True})

	def test_logging_failure_never_blocks_the_change(self):
		with patch("jms.accounting_log._write", side_effect=Exception("boom")):
			mop = self.new_mode_of_payment()
		self.assertTrue(frappe.db.exists("Mode of Payment", mop.name))

	def test_sales_invoice_submit_edit_and_cancel(self):
		company, customer = _first("Company"), _first("Customer")
		item = _first("Item", {"is_stock_item": 0, "disabled": 0, "has_variants": 0})
		job = _first("Job", {"status": ["!=", "Cancelled"]})
		if not all([company, customer, item, job]):
			self.skipTest("missing company/customer/non-stock item/job")

		si = frappe.get_doc(
			{
				"doctype": "Sales Invoice",
				"company": company,
				"customer": customer,
				"posting_date": nowdate(),
				"due_date": nowdate(),
				"job": job,  # Job is a mandatory accounting dimension
				"items": [{"item_code": item, "qty": 1, "rate": 100}],
			}
		)
		try:
			si.insert()
		except Exception as e:
			self.skipTest(f"cannot create a Sales Invoice here: {e}")

		si.items[0].rate = 120
		si.save()
		si.submit()
		si.cancel()

		rows = self.rows(si.name)
		self.assertEqual([r.action for r in rows], ["Created", "Edited", "Submitted", "Cancelled"])
		self.assertIn("Rate (Items row 1", rows[1].details)
		self.assertTrue(rows[2].party)
		self.assertEqual(rows[2].amount, si.rounded_total or si.grand_total)
		# side effects of the rate change are left out
		for noise in ("Base", "In Words", "Net Total", "Outstanding", "Payment Schedule", "(empty) → (empty)"):
			self.assertNotIn(noise, rows[1].details)
		self.assertIn("Grand Total: 100.00 → 120.00", rows[1].details)

	def test_job_is_logged_only_when_money_changes(self):
		company, customer, job_type = _first("Company"), _first("Customer"), _first("Job Type")
		template = _first("Work Template")
		if not all([company, customer, job_type, template]):
			self.skipTest("missing company/customer/job type/work template")

		job = frappe.new_doc("Job")
		job.job_title = "testctl accounting change log job"
		job.date = job.start_date = nowdate()
		job.status = "Created"
		job.job_type = job_type
		job.receivable_from = "Customer"
		job.customer = customer
		job.company = company
		job.append("items", {"work_template": template, "fee_price": 100})
		job.insert(ignore_permissions=True)

		job.job_title = "renamed"
		job.save(ignore_permissions=True)
		self.assertEqual(self.rows(job.name), [])

		job.items[0].fee_price = 150
		job.save(ignore_permissions=True)
		rows = self.rows(job.name)
		self.assertEqual([r.action for r in rows], ["Edited"])
		self.assertIn("Service Charge (Items row 1", rows[0].details)
		self.assertNotIn("Job Title", rows[0].details)

	def test_values_sent_as_text_by_the_form_are_shown_correctly(self):
		mop = self.new_mode_of_payment()
		mop.enabled = "0"  # the desk sends checkbox values as text
		mop.save()
		self.assertEqual(self.rows(mop.name)[-1].details, "Enabled: Yes → No")
