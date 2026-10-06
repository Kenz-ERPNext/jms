# Copyright (c) 2026, Kenz and contributors
# When a doctype has Custom DocPerm rows (from Role Permission Manager), Frappe
# ignores the permissions in the doctype JSON for it. On such sites the roles the
# app ships (Admin, Accounts User, Task Staff) had no access to Job and the
# masters. Copy their rows into Custom DocPerm, and leave every other role's
# existing rows as they are.

import frappe
from frappe.permissions import add_permission, update_permission_property

ROLES = ("Admin", "Accounts User", "Task Staff")
RIGHTS = ("select", "read", "write", "create", "delete", "submit", "cancel", "amend",
	"report", "export", "import", "share", "print", "email")


def execute():
	for doctype in frappe.get_all("DocType", filters={"module": "Jms"}, pluck="name"):
		if not frappe.db.exists("Custom DocPerm", {"parent": doctype}):
			continue  # no custom rows, the JSON permissions apply as they are

		standard = frappe.get_all(
			"DocPerm", filters={"parent": doctype, "role": ["in", ROLES]}, fields=["role", "permlevel", *RIGHTS]
		)
		for row in standard:
			add_permission(doctype, row.role, row.permlevel)
			for right in RIGHTS:
				if row.get(right):
					update_permission_property(doctype, row.role, row.permlevel, right, 1)
		frappe.clear_cache(doctype=doctype)
