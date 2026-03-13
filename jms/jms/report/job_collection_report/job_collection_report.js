// Copyright (c) 2026, sammish and contributors
// For license information, please see license.txt

frappe.query_reports["Job Collection Report"] = {
    filters: [
        {
            fieldname: "from_date",
            label: __("From Date"),
            fieldtype: "Date",
            default: frappe.datetime.month_start()
        },
        {
            fieldname: "to_date",
            label: __("To Date"),
            fieldtype: "Date",
            default: frappe.datetime.month_end()
        },
        {
            fieldname: "job",
            label: __("Job"),
            fieldtype: "Link",
            options: "Job"
        },
        {
            fieldname: "customer",
            label: __("Customer"),
            fieldtype: "Link",
            options: "Customer"
        },
        {
            fieldname: "agent",
            label: __("Agent"),
            fieldtype: "Link",
            options: "Agent"
        }, 
        // {
        //     fieldname: "invoice_filter",
        //     label: __("Sales Invoice Status"),
        //     fieldtype: "Select",
        //     options: [
        //         { value: "ALL", label: __("All") },
        //         { value: "NOT_CREATED", label: __("Sales Invoice Not Created") },
        //         { value: "NOT_COLLECTED", label: __("SI Created but Amount Not Collected") }
        //     ],
        //     default: "ALL"
        // }
    ]
};
