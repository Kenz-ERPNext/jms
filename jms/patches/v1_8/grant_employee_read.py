# Copyright (c) 2026, Kenz and contributors
# Assigning a task to an Employee reads the Employee record (the task's
# "Employee User" is fetched from it, and the Employee link search needs read
# access). Accounts User and Admin add jobs and tasks, so they need Employee
# read. add_permission keeps the permissions the doctype already has, and
# update_permission_property switches read on if the role's row had it off.

import frappe
from frappe.permissions import add_permission, update_permission_property

ROLES = ("Accounts User", "Admin")


def execute():
	for role in ROLES:
		if not frappe.db.exists("Role", role):
			frappe.get_doc({"doctype": "Role", "role_name": role, "desk_access": 1}).insert(
				ignore_permissions=True
			)
		add_permission("Employee", role, 0, "read")
		# the role may already have a row with read switched off
		update_permission_property("Employee", role, 0, "read", 1)
	frappe.clear_cache(doctype="Employee")
