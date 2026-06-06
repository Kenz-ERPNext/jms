// Copyright (c) 2026, Kenz and contributors
// For license information, please see license.txt

frappe.query_reports["Job Supplier Payment Report"] = {
	filters: [
		{
			fieldname: "view",
			label: __("View"),
			fieldtype: "Select",
			options: ["Detail", "Summary"].join("\n"),
			default: "Detail",
			reqd: 1,
		},
		{ fieldname: "from_date", label: __("From Date"), fieldtype: "Date", default: frappe.datetime.add_months(frappe.datetime.month_start(), -2) },
		{ fieldname: "to_date", label: __("To Date"), fieldtype: "Date", default: frappe.datetime.month_end() },
		{ fieldname: "agent", label: __("Agent"), fieldtype: "Link", options: "Agent" },
		{ fieldname: "customer", label: __("Customer"), fieldtype: "Link", options: "Customer" },
		{
			fieldname: "status",
			label: __("Status"),
			fieldtype: "Select",
			options: ["", "Created", "In Progress", "Processing", "Completed", "Rejected", "Cancelled"].join("\n"),
		},
		{ fieldname: "only_outsource", label: __("Only Outsourced Jobs"), fieldtype: "Check" },
	],

	formatter: function (value, row, column, data, default_formatter) {
		value = default_formatter(value, row, column, data);
		if ((column.fieldname === "outstanding" || column.fieldname === "supplier_balance") && data && data[column.fieldname] > 0) {
			value = `<span style="color:#a4161a;font-weight:600;">${value}</span>`;
		}
		if (column.fieldname === "net_profit" && data) {
			const c = data.net_profit < 0 ? "#a4161a" : "#1b4332";
			value = `<span style="color:${c};font-weight:600;">${value}</span>`;
		}
		return value;
	},
};
