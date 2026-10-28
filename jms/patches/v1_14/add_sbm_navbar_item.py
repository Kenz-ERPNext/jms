# Copyright (c) 2026, Kenz and contributors
# "Open SBM" at the top of the ERPNext user menu (avatar, top right), so the
# Administrator can go from the desk to the SBM app. Idempotent.

import frappe

LABEL = "Open SBM"
ROUTE = "/sbm"


def execute():
	settings = frappe.get_single("Navbar Settings")
	if any(item.route == ROUTE for item in settings.settings_dropdown):
		return
	settings.append(
		"settings_dropdown", {"item_label": LABEL, "item_type": "Route", "route": ROUTE, "is_standard": 0}
	)
	# put it first
	items = settings.settings_dropdown
	items.insert(0, items.pop())
	for i, item in enumerate(items, start=1):
		item.idx = i
	settings.save(ignore_permissions=True)
