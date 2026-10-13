// Copyright (c) 2026, sammish and contributors
// For license information, please see license.txt

frappe.ui.form.on("Accounting Change Log", {
	refresh(frm) {
		frm.add_custom_button(__("Accounting Activity"), () => frappe.set_route("accounting-activity"));
	},
});
