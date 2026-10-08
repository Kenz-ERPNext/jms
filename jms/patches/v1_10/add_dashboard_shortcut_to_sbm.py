# Copyright (c) 2026, Kenz and contributors
# Put a "SBM Dashboard" shortcut on the SBM workspace (the home page of JMS in the
# desk), next to the existing Job Portal and Job Pipeline shortcuts.

import json

import frappe

LABEL = "SBM Dashboard"
URL = "/app/jms-dashboard"


def execute():
	if not frappe.db.exists("Workspace", "SBM"):
		return

	workspace = frappe.get_doc("Workspace", "SBM")
	# match on the URL too: the shortcut may still carry its old name "JMS Dashboard"
	existing = [row for row in workspace.shortcuts if row.label == LABEL or row.url in (URL, "/portal")]
	if existing:
		for row in existing:
			if row.url != URL:
				frappe.db.set_value("Workspace Shortcut", row.name, "url", URL)
		return

	# Saving the Workspace document is refused (its route "sbm" clashes with the
	# sbm Page), so write the shortcut row and the layout directly.
	shortcut = frappe.get_doc(
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
	)
	shortcut.db_insert()

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
			if b.get("type") == "shortcut" and b["data"].get("shortcut_name") == "Job Pipeline"
		),
		-1,
	)
	content.insert(after + 1, block)
	frappe.db.set_value("Workspace", "SBM", "content", json.dumps(content))
	frappe.clear_cache()
