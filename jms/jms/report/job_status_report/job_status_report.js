// Copyright (c) 2025, Your Company and contributors
// For license information, please see license.txt

frappe.query_reports["Job Status Report"] = {
	"filters": [
		{
			"fieldname": "status",
			"label": __("Status"),
			"fieldtype": "Select",
			"options": "\nDraft\nIn Progress\nOn Hold\nUnder Review\nCompleted\nCancelled"
		},
		{
			"fieldname": "job_type",
			"label": __("Job Type"),
			"fieldtype": "Link",
			"options": "Job Type"
		},
		{
			"fieldname": "customer",
			"label": __("Customer"),
			"fieldtype": "Link",
			"options": "Customer"
		},
		{
			"fieldname": "from_date",
			"label": __("From Date"),
			"fieldtype": "Date",
			"default": frappe.datetime.add_months(frappe.datetime.get_today(), -1)
		},
		{
			"fieldname": "to_date",
			"label": __("To Date"),
			"fieldtype": "Date",
			"default": frappe.datetime.get_today()
		}
	]
};
