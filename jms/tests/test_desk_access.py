# Copyright (c) 2026, Kenz and contributors
# Only the Administrator may open the ERPNext desk; everyone else is sent to SBM.

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

	def test_only_administrator_by_default(self):
		self.assertTrue(desk_access.can_use_desk("Administrator"))
		self.assertFalse(desk_access.can_use_desk("someone@example.com"))

	def test_site_config_can_allow_more(self):
		with patch.dict(frappe.local.conf, {"sbm_desk_users": ["support@example.com"]}):
			self.assertTrue(desk_access.can_use_desk("support@example.com"))
