# Copyright (c) 2026, Kenz and contributors
# Show the SBM Dashboard as its own large card at the top of the SBM workspace
# (a Custom HTML Block, visible to Admin and System Manager only) instead of a
# small shortcut among the others.

import json

import frappe

BLOCK = "SBM Dashboard"
URL = "/app/jms-dashboard"
ROLES = ("Admin", "System Manager")

HTML = """
<a class="sbm-dash-card" href="/app/jms-dashboard">
  <span class="sbm-dash-icon">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1"></rect><rect x="14" y="3" width="7" height="5" rx="1"></rect>
      <rect x="14" y="12" width="7" height="9" rx="1"></rect><rect x="3" y="16" width="7" height="5" rx="1"></rect>
    </svg>
  </span>
  <span class="sbm-dash-text">
    <span class="sbm-dash-title">SBM Dashboard</span>
    <span class="sbm-dash-sub">Task status, jobs and pending reasons at a glance</span>
  </span>
  <span class="sbm-dash-arrow">&rarr;</span>
</a>
"""

STYLE = """
.sbm-dash-card { display: flex; align-items: center; gap: 12px; padding: 12px 16px;
  border: 1px solid var(--border-color); border-radius: var(--border-radius-lg, 12px);
  background: var(--card-bg, #fff); color: var(--text-color); text-decoration: none;
  transition: box-shadow .15s, border-color .15s; }
.sbm-dash-card:hover { text-decoration: none; border-color: var(--gray-400);
  box-shadow: var(--shadow-md, 0 4px 12px rgba(0,0,0,.08)); }
.sbm-dash-icon { display: flex; align-items: center; justify-content: center; width: 36px;
  height: 36px; border-radius: 8px; background: var(--gray-900, #171717); color: #fff; flex-shrink: 0; }
.sbm-dash-text { display: flex; flex-direction: column; gap: 1px; flex: 1; min-width: 0; }
.sbm-dash-title { font-size: 15px; font-weight: 600; color: var(--heading-color, var(--text-color)); }
.sbm-dash-sub { font-size: 12.5px; color: var(--text-muted); }
.sbm-dash-arrow { font-size: 18px; color: var(--text-muted); transition: transform .15s; }
.sbm-dash-card:hover .sbm-dash-arrow { transform: translateX(4px); color: var(--text-color); }
"""


def execute():
	if not frappe.db.exists("Workspace", "SBM"):
		return

	if frappe.db.exists("Custom HTML Block", BLOCK):
		block = frappe.get_doc("Custom HTML Block", BLOCK)
	else:
		block = frappe.new_doc("Custom HTML Block")
		block.name = BLOCK
	block.html = HTML
	block.style = STYLE
	block.private = 0
	block.set("roles", [{"role": role} for role in ROLES if frappe.db.exists("Role", role)])
	if block.is_new():
		block.insert(ignore_permissions=True, set_name=BLOCK)
	else:
		block.save(ignore_permissions=True)

	# The Workspace document cannot be saved (its route clashes with the sbm
	# Page), so update its rows and layout directly.
	for name in frappe.get_all("Workspace Shortcut", filters={"parent": "SBM", "url": URL}, pluck="name"):
		frappe.db.delete("Workspace Shortcut", name)

	if not frappe.db.exists("Workspace Custom Block", {"parent": "SBM", "custom_block_name": BLOCK}):
		count = frappe.db.count("Workspace Custom Block", {"parent": "SBM"})
		frappe.get_doc(
			{
				"doctype": "Workspace Custom Block",
				"parent": "SBM",
				"parenttype": "Workspace",
				"parentfield": "custom_blocks",
				"idx": count + 1,
				"custom_block_name": BLOCK,
				"label": BLOCK,
			}
		).db_insert()

	content = json.loads(frappe.db.get_value("Workspace", "SBM", "content") or "[]")
	content = [
		b
		for b in content
		if not (b.get("type") == "shortcut" and b["data"].get("shortcut_name") in ("SBM Dashboard", "JMS Dashboard"))
		and not (b.get("type") == "custom_block" and b["data"].get("custom_block_name") == BLOCK)
	]
	# right above the "Service Business Management" heading (top if it is missing)
	at = next(
		(
			i
			for i, b in enumerate(content)
			if b.get("type") == "header" and "Service Business Management" in b["data"].get("text", "")
		),
		0,
	)
	content.insert(
		at,
		{"id": frappe.generate_hash(length=10), "type": "custom_block", "data": {"custom_block_name": BLOCK, "col": 12}},
	)
	frappe.db.set_value("Workspace", "SBM", "content", json.dumps(content))
	frappe.clear_cache()
