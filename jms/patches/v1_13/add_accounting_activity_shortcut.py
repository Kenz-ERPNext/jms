# Copyright (c) 2026, Kenz and contributors
# Put an "Accounting Activity" shortcut on the SBM workspace, after the SBM
# Dashboard shortcut, so the client finds the live accounting log from home.

import json

import frappe

LABEL = "Accounting Activity"
URL = "/app/accounting-activity"


def execute():
	if not frappe.db.exists("Workspace", "SBM"):
		return

	workspace = frappe.get_doc("Workspace", "SBM")
	if any(row.label == LABEL or row.url == URL for row in workspace.shortcuts):
		return

	# Saving the Workspace document is refused (its route "sbm" clashes with the
	# sbm Page), so write the shortcut row and the layout directly.
	frappe.get_doc(
		{
			"doctype": "Workspace Shortcut",
			"parent": "SBM",
			"parenttype": "Workspace",
			"parentfield": "shortcuts",
			"idx": len(workspace.shortcuts) + 1,
			"label": LABEL,
			"type": "URL",
			"url": URL,
		}
	).db_insert()

	content = json.loads(workspace.content or "[]")
	block = {
		"id": frappe.generate_hash(length=10),
		"type": "shortcut",
		"data": {"shortcut_name": LABEL, "col": 3},
	}
	after = next(
		(
			i
			for i, b in enumerate(content)
			if b.get("type") == "shortcut" and b["data"].get("shortcut_name") == "SBM Dashboard"
		),
		-1,
	)
	content.insert(after + 1, block)
	frappe.db.set_value("Workspace", "SBM", "content", json.dumps(content))
	frappe.clear_cache()
