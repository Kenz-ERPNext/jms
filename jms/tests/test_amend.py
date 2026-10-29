# Copyright (c) 2026, Kenz and contributors
# Amend through SBM: the checks before a Job method runs again, and which new
# document becomes the amendment.

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase

from jms.api import amend


def _old(docstatus=2, job="JOB-1"):
	return frappe._dict(docstatus=docstatus, job=job, custom_job=None)


class TestAmend(FrappeTestCase):
	def tearDown(self):
		frappe.flags.jms_amend = None

	def test_first_new_doc_of_the_doctype_is_the_amendment(self):
		frappe.flags.jms_amend = {"doctype": "Sales Invoice", "name": "SINV-1"}
		pe = frappe._dict(doctype="Payment Entry")
		si = frappe._dict(doctype="Sales Invoice")
		si2 = frappe._dict(doctype="Sales Invoice")
		for doc in (pe, si, si2):
			amend.set_amended_from(doc)
		self.assertIsNone(pe.get("amended_from"))
		self.assertEqual(si.amended_from, "SINV-1")
		self.assertIsNone(si2.get("amended_from"))

	def test_amended_invoice_gets_the_job_advances(self):
		frappe.flags.jms_amend = {"doctype": "Purchase Invoice", "name": "PINV-1"}
		pi = frappe._dict(doctype="Purchase Invoice", job="JOB-1", advances=[])
		with patch.object(frappe, "get_doc") as get_doc:
			amend.set_amended_from(pi)
		get_doc.assert_called_once_with("Job", "JOB-1")
		get_doc.return_value._apply_job_advances.assert_called_once_with(pi)

	def test_advances_already_applied_are_kept(self):
		frappe.flags.jms_amend = {"doctype": "Sales Invoice", "name": "SINV-1"}
		si = frappe._dict(doctype="Sales Invoice", job="JOB-1", advances=[{"x": 1}])
		with patch.object(frappe, "get_doc") as get_doc:
			amend.set_amended_from(si)
		get_doc.assert_not_called()

	def test_nothing_set_outside_an_amendment(self):
		si = frappe._dict(doctype="Sales Invoice")
		amend.set_amended_from(si)
		self.assertIsNone(si.get("amended_from"))

	def _run(self, old, exists=False, method="create_invoice", doctype="Sales Invoice"):
		with (
			patch.object(frappe.db, "get_value", return_value=old),
			patch.object(frappe.db, "exists", return_value=exists),
			patch.object(amend, "run_doc_method") as run,
		):
			amend.run_amendment("JOB-1", method, doctype, "SINV-1", "{}")
			return run

	def test_refuses(self):
		for kwargs, why in (
			({"old": _old(), "method": "close_job"}, "not a job action"),
			({"old": _old(), "doctype": "Journal Entry"}, "cannot be amended"),
			({"old": None}, "not found"),
			({"old": _old(docstatus=1)}, "Cancel"),
			({"old": _old(job="JOB-2")}, "does not belong"),
			({"old": _old(), "exists": True}, "already amended"),
		):
			with self.assertRaises(frappe.ValidationError, msg=why) as ctx:
				self._run(**kwargs)
			self.assertIn(why, str(ctx.exception))

	def test_fails_when_the_method_makes_no_such_doc(self):
		# the patched method inserts nothing, so nothing was amended
		with self.assertRaises(frappe.ValidationError) as ctx:
			self._run(_old())
		self.assertIn("did not make", str(ctx.exception))
		self.assertIsNone(frappe.flags.jms_amend)

	def test_runs_the_job_method_as_an_amendment(self):
		def make_si(method, dt, dn, args):
			amend.set_amended_from(frappe._dict(doctype="Sales Invoice"))
			frappe.response["message"] = "SINV-1-1"

		with (
			patch.object(frappe.db, "get_value", return_value=_old()),
			patch.object(frappe.db, "exists", return_value=False),
			patch.object(amend, "run_doc_method", side_effect=make_si) as run,
		):
			self.assertEqual(
				amend.run_amendment("JOB-1", "create_invoice", "Sales Invoice", "SINV-1", "{}"),
				"SINV-1-1",
			)
		run.assert_called_once_with("create_invoice", dt="Job", dn="JOB-1", args="{}")
		self.assertIsNone(frappe.flags.jms_amend)
