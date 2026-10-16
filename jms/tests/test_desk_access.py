# Copyright (c) 2026, Kenz and contributors
# Only System Managers and Admins may open the ERPNext desk; everyone else is sent to SBM.

from unittest.mock import patch

import frappe
from frappe.tests.utils import FrappeTestCase

from jms import desk_access


class TestDeskAccess(FrappeTestCase):
	def test_desk_paths(self):
		for path in ("/app", "/app/job/JOB-1", "/apps", "/desk"):
			self.assertTrue(desk_access.is_desk_path(path), path)
		# SBM, the API, print and login are not desk pages
		for path in ("/sbm", "/sbm/dashboard", "/api/method/x", "/printview", "/login", "/application"):
			self.assertFalse(desk_access.is_desk_path(path), path)

	def test_desk_roles(self):
		self.assertTrue(desk_access.can_use_desk("Administrator"))
		for roles, allowed in (
			(["System Manager"], True),
			(["Admin"], True),
			(["Accounts User", "Accounts Manager"], False),
			(["Task Staff"], False),
		):
			with patch.object(frappe, "get_roles", return_value=roles):
				self.assertEqual(desk_access.can_use_desk("someone@example.com"), allowed, roles)

	def test_site_config_can_allow_more(self):
		with (
			patch.dict(frappe.local.conf, {"sbm_desk_users": ["support@example.com"]}),
			patch.object(frappe, "get_roles", return_value=["Accounts User"]),
		):
			self.assertTrue(desk_access.can_use_desk("support@example.com"))
