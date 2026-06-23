// Copyright (c) 2026, Kenz and contributors

frappe.query_reports["Pending Tasks"] = {
	"filters": [
		{
			"fieldname": "company",
			"label": __("Company"),
			"fieldtype": "Link",
			"options": "Company",
			"default": frappe.defaults.get_user_default("Company")
		},
		{
			"fieldname": "job",
			"label": __("Job"),
			"fieldtype": "Link",
			"options": "Job"
		},
		{
			"fieldname": "status",
			"label": __("Task Status"),
			"fieldtype": "Select",
			"options": "\nPending\nIn Progress\nOpen"
		}
	]
};
