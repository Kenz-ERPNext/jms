// Copyright (c) 2026, Kenz and contributors

frappe.query_reports["Employee Task Report"] = {
	"filters": [
		{
			"fieldname": "company",
			"label": __("Company"),
			"fieldtype": "Link",
			"options": "Company",
			"default": frappe.defaults.get_user_default("Company")
		},
		{
			"fieldname": "assigned_to",
			"label": __("Assigned To"),
			"fieldtype": "Data"
		},
		{
			"fieldname": "status",
			"label": __("Task Status"),
			"fieldtype": "Select",
			"options": "\nPending\nIn Progress\nOpen\nCompleted"
		}
	]
};
