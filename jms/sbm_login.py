# Copyright (c) 2026, Kenz and contributors
# ERPNext's /login shows the SBM (React) login page: the URL stays /login, the
# page is jms/www/sbm.html and React shows the login form for this path.
# /login?desk=1 still opens the ERPNext login, as a fallback if the frontend is broken.

import frappe
from frappe.website.page_renderers.template_page import TemplatePage


class SBMLoginPage:
	def __init__(self, path, http_status_code=None):
		self.path = path
		self.http_status_code = http_status_code

	def can_render(self):
		return self.path == "login" and not frappe.form_dict.get("desk")

	def render(self):
		return TemplatePage("sbm", self.http_status_code).render()
