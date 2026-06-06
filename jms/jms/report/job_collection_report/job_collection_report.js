// Copyright (c) 2026, Kenz and contributors
// For license information, please see license.txt

frappe.query_reports["Job Collection Report"] = {
	filters: [
		{ fieldname: "from_date", label: __("From Date"), fieldtype: "Date", default: frappe.datetime.add_months(frappe.datetime.month_start(), -2) },
		{ fieldname: "to_date", label: __("To Date"), fieldtype: "Date", default: frappe.datetime.month_end() },
		{ fieldname: "job", label: __("Job"), fieldtype: "Link", options: "Job" },
		{ fieldname: "customer", label: __("Customer"), fieldtype: "Link", options: "Customer" },
		{ fieldname: "agent", label: __("Agent"), fieldtype: "Link", options: "Agent" },
		{
			fieldname: "status",
			label: __("Status"),
			fieldtype: "Select",
			options: ["", "Created", "In Progress", "Processing", "Completed", "Rejected", "Cancelled"].join("\n"),
		},
		{ fieldname: "only_pending", label: __("Only Pending Collection"), fieldtype: "Check" },
	],

	formatter: function (value, row, column, data, default_formatter) {
		value = default_formatter(value, row, column, data);
		if (column.fieldname === "outstanding" && data && data.outstanding > 0) {
			value = `<span style="color:#a4161a;font-weight:600;">${value}</span>`;
		}
		if (column.fieldname === "net_profit" && data) {
			const c = data.net_profit < 0 ? "#a4161a" : "#1b4332";
			value = `<span style="color:${c};font-weight:600;">${value}</span>`;
		}
		return value;
	},
};
