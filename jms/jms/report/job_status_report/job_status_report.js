// Copyright (c) 2025, Your Company and contributors
// For license information, please see license.txt

frappe.query_reports["Job Status Report"] = {
	"filters": [
		{
			"fieldname": "scenario",
			"label": __("Scenario"),
			"fieldtype": "Select",
			"options": [
				"",
				"Remaining for Collection",
				"Remaining for Payment",
				"Remaining for Task Completion",
				"All Completed"
			].join("\n"),
			"default": ""
		},
		{
			"fieldname": "company",
			"label": __("Company"),
			"fieldtype": "Link",
			"options": "Company",
			"default": frappe.defaults.get_user_default("Company")
		},
		{
			"fieldname": "status",
			"label": __("Status"),
			"fieldtype": "Select",
			"options": "\nCreated\nIn Progress\nProcessing\nCompleted\nRejected\nCancelled\nSupervisor Approved\nMD Approved"
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
			"label": __("Start From"),
			"fieldtype": "Date"
		},
		{
			"fieldname": "to_date",
			"label": __("Start To"),
			"fieldtype": "Date"
		}
	],

	"formatter": function (value, row, column, data, default_formatter) {
		value = default_formatter(value, row, column, data);
		if (column.fieldname === "stage" && data && data.stage) {
			const colors = {
				"Processing Work": "#f59e0b",
				"Amount Pending": "#ef4444",
				"Exp Pending": "#a855f7",
				"Amount + Exp Pending": "#ef4444",
				"Completed": "#16a34a",
				"Cancelled": "#9ca3af"
			};
			const c = colors[data.stage] || "#374151";
			value = `<span style="color:${c};font-weight:600;">${value}</span>`;
		}
		return value;
	}
};
