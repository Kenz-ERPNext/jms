// Copyright (c) 2026, Kenz and contributors

frappe.query_reports["Monthly Profit"] = {
	"filters": [
		{
			"fieldname": "company",
			"label": __("Company"),
			"fieldtype": "Link",
			"options": "Company",
			"default": frappe.defaults.get_user_default("Company")
		},
		{
			"fieldname": "from_date",
			"label": __("Closed From"),
			"fieldtype": "Date",
			"default": frappe.datetime.year_start()
		},
		{
			"fieldname": "to_date",
			"label": __("Closed To"),
			"fieldtype": "Date",
			"default": frappe.datetime.year_end()
		}
	]
};
