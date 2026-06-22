import frappe


def execute():
	"""Rename the public "JMS" workspace to "SBM".

	A workspace's URL/route is derived from its document `name` (slugified),
	while the sidebar link is built from its `title`. Keeping name="JMS" with
	title="SBM" made the sidebar link to /app/sbm while the record resolved at
	/app/jms -> "Page sbm not found". Renaming the record keeps them in sync.

	Idempotent and order-independent: handles the case where the new SBM
	workspace JSON was already imported during the same migrate (both exist).
	"""
	if not frappe.db.table_exists("Workspace"):
		return

	has_old = frappe.db.exists("Workspace", "JMS")
	has_new = frappe.db.exists("Workspace", "SBM")

	if has_old and has_new:
		# fresh JSON already created "SBM"; drop the stale "JMS"
		frappe.delete_doc("Workspace", "JMS", force=True, ignore_permissions=True)
	elif has_old:
		frappe.rename_doc("Workspace", "JMS", "SBM", force=True)

	if frappe.db.exists("Workspace", "SBM"):
		frappe.db.set_value(
			"Workspace", "SBM", {"title": "SBM", "label": "SBM"}, update_modified=False
		)

	frappe.db.commit()
