# Copyright (c) 2026, Kenz and contributors
# "SBM Admin" Role Profile: the roles an Admin needs to see and do everything in SBM
# that the Administrator can (the Admin role alone cannot read customers, invoices or
# payments). Give it to a user in the User form (Role Profile). Idempotent.

import frappe

PROFILE = "SBM Admin"
ROLES = ("Admin", "System Manager", "Accounts Manager")


def execute():
	roles = [r for r in ROLES if frappe.db.exists("Role", r)]
	if frappe.db.exists("Role Profile", PROFILE):
		profile = frappe.get_doc("Role Profile", PROFILE)
		have = {r.role for r in profile.roles}
		for role in roles:
			if role not in have:
				profile.append("roles", {"role": role})
		profile.save(ignore_permissions=True)
		return
	frappe.get_doc(
		{"doctype": "Role Profile", "role_profile": PROFILE, "roles": [{"role": r} for r in roles]}
	).insert(ignore_permissions=True)
