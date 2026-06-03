// Copyright (c) 2026, Kenz and contributors
// For license information, please see license.txt

frappe.query_reports["Job Profitability"] = {
	filters: [
		{
			fieldname: "company",
			label: __("Company"),
			fieldtype: "Link",
			options: "Company",
			default: frappe.defaults.get_user_default("company"),
		},
		{
			fieldname: "from_date",
			label: __("From Date"),
			fieldtype: "Date",
		},
		{
			fieldname: "to_date",
			label: __("To Date"),
			fieldtype: "Date",
		},
		{
			fieldname: "customer",
			label: __("Customer"),
			fieldtype: "Link",
			options: "Customer",
		},
		{
			fieldname: "agent",
			label: __("Agent"),
			fieldtype: "Link",
			options: "Agent",
		},
		{
			fieldname: "status",
			label: __("Status"),
			fieldtype: "Select",
			options: ["", "Created", "In Progress", "Processing", "Completed", "Rejected", "Cancelled"].join("\n"),
		},
	],

	formatter: function (value, row, column, data, default_formatter) {
		value = default_formatter(value, row, column, data);
		if (column.fieldname === "net_profit" && data && data.net_profit < 0) {
			value = `<span style="color:#a4161a;font-weight:600;">${value}</span>`;
		}
		if (column.fieldname === "net_profit" && data && data.net_profit > 0) {
			value = `<span style="color:#1b4332;font-weight:600;">${value}</span>`;
		}
		return value;
	},
};
