# Copyright (c) 2026, Kenz and contributors
# The SBM workspace's "Job" shortcut used to carry
# stats_filter = {"status": "In Progress"}. Clicking it opened the Job list
# as /app/job?status=In+Progress, and Frappe then saved that filter into the
# user's list settings — so the list looked permanently filtered. The filter
# was removed from jms/jms/workspace/sbm/sbm.json in commit 308b6dd, but a
# workspace already edited on a site keeps its DB copy on migrate, so
# production still had the old shortcut. Clear it in the DB to match the
# repo JSON. Idempotent — safe to re-run.

import frappe


def execute():
	rows = frappe.get_all(
		"Workspace Shortcut",
		filters={"parent": "SBM", "type": "DocType", "link_to": "Job"},
		fields=["name", "stats_filter"],
	)
	changed = False
	for r in rows:
		if r.stats_filter and "status" in r.stats_filter:
			frappe.db.set_value("Workspace Shortcut", r.name, "stats_filter", "{}", update_modified=False)
			changed = True

	if changed:
		frappe.clear_cache()
