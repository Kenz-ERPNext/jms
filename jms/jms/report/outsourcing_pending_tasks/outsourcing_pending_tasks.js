// Copyright (c) 2026, Kenz and contributors

frappe.query_reports["Outsourcing Pending Tasks"] = {
	"filters": [
		{
			"fieldname": "company",
			"label": __("Company"),
			"fieldtype": "Link",
			"options": "Company",
			"default": frappe.defaults.get_user_default("Company")
		},
		{
			"fieldname": "vendor",
			"label": __("Vendor"),
			"fieldtype": "Link",
			"options": "Supplier"
		}
	]
};
