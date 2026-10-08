# Copyright (c) 2026, Kenz and contributors
# The dashboard was renamed from "JMS Dashboard" to "SBM Dashboard". Rename the
# shortcut that v1_10 put on the SBM workspace on sites where it already ran, and
# keep only one if a site ended up with two.

import json

import frappe

OLD, NEW = "JMS Dashboard", "SBM Dashboard"


def execute():
	if not frappe.db.exists("Workspace", "SBM"):
		return

	# The Workspace document cannot be saved (its route clashes with the sbm
	# Page), so update the shortcut row and the layout directly.
	rows = frappe.get_all(
		"Workspace Shortcut",
		filters={"parent": "SBM", "label": ["in", [OLD, NEW]]},
		pluck="name",
		order_by="idx asc",
	)
	if rows:
		frappe.db.set_value("Workspace Shortcut", rows[0], "label", NEW)
		for extra in rows[1:]:
			frappe.db.delete("Workspace Shortcut", extra)

	content = json.loads(frappe.db.get_value("Workspace", "SBM", "content") or "[]")
	kept, seen = [], False
	for block in content:
		if block.get("type") == "shortcut" and block["data"].get("shortcut_name") in (OLD, NEW):
			if seen:
				continue
			block["data"]["shortcut_name"] = NEW
			seen = True
		kept.append(block)
	frappe.db.set_value("Workspace", "SBM", "content", json.dumps(kept))
	frappe.clear_cache()
