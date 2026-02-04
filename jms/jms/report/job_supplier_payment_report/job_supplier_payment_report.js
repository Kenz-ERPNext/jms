frappe.query_reports["Job Supplier Payment Report"] = {
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
            default: frappe.datetime.get_today()
        },
        {
            fieldname: "job",
            label: __("Job"),
            fieldtype: "Link",
            options: "Job"
        },
        {
            fieldname: "outsourced_party",
            label: __("Outsourced Party"),
            fieldtype: "Link",
            options: "Outsourced Party"
        },
        {
            fieldname: "only_outsource",
            label: __("Only Show Outsource Jobs"),
            fieldtype: "Check",
            default: 0
        }
    ]
};
