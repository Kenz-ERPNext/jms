# Copyright (c) 2026, Kenz and contributors
# Only System Managers and Admins (and the Administrator) work in the ERPNext desk;
# everyone else uses SBM (/sbm). A logged-in user without those roles who opens a
# desk page (/app, /apps, /desk) is sent to SBM. More desk users can be allowed per
# site: "sbm_desk_users": ["a@b.com"] in site_config.
# Guests are left alone (Frappe sends them to the login page), and /api is untouched,
# so SBM itself keeps working.

import frappe
from werkzeug.exceptions import HTTPException
from werkzeug.utils import redirect

DESK_ROLES = {"System Manager", "Admin"}
DESK_PATHS = ("/app", "/apps", "/desk")
SBM_HOME = "/sbm"


def can_use_desk(user=None):
	user = user or frappe.session.user
	return (
		user == "Administrator"
		or bool(DESK_ROLES & set(frappe.get_roles(user)))
		or user in (frappe.conf.get("sbm_desk_users") or [])
	)


def is_desk_path(path):
	return any(path == p or path.startswith(p + "/") for p in DESK_PATHS)


def block_desk():
	"""before_request hook: send non-desk users from a desk page to SBM."""
	request = getattr(frappe.local, "request", None)
	if not request or not is_desk_path(request.path):
		return
	user = frappe.session.user
	if user == "Guest" or can_use_desk(user):
		return
	raise HTTPException(response=redirect(SBM_HOME, code=302))
