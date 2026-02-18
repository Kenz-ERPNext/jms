// Copyright (c) 2026, sammish and contributors
// For license information, please see license.txt

frappe.query_reports["Job Gross Profit"] = {
	"filters": [
        {
            "fieldname": "from_date",
            "label": "From Date",
            "fieldtype": "Date",
            // "reqd": 1
        },
        {
            "fieldname": "to_date",
            "label": "To Date",
            "fieldtype": "Date",
            // "reqd": 1
        },
        {
            "fieldname": "job",
            "label": "Job",
            "fieldtype": "Link",
            "options": "Job"
        },
        {
            "fieldname": "customer",
            "label": "Customer",
            "fieldtype": "Link",
            "options": "Customer"
        }
    ]
};