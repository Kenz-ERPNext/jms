# Copyright (c) 2026, Kenz and contributors
# The SBM frontend page: /sbm and every /sbm/... route (see website_route_rules).
# Guests get it too, so the React login page can load.

import os

import frappe
from frappe.sessions import get_csrf_token

from jms.api.boot import get_boot

no_cache = 1
BUILD_DIR = ("public", "sbm")


def get_context(context):
	"""Give the page the CSRF token, the boot data and the build version."""
	context.no_cache = 1
	context.csrf_token = get_csrf_token()
	# a GET request is rolled back: commit so the new CSRF token is kept
	frappe.db.commit()
	context.boot = get_boot() if frappe.session.user != "Guest" else {"user": "Guest"}
	context.build_version = _build_version()


def _build_version():
	"""Changes on every frontend build, so browsers load the new files. None
	when the frontend is not built yet (the page then says so)."""
	path = frappe.get_app_path("jms", *BUILD_DIR, "sbm.js")
	return int(os.path.getmtime(path)) if os.path.exists(path) else None
