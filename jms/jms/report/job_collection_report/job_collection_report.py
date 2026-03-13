import frappe


def execute(filters=None):
    filters = filters or {}
    columns = get_columns()
    data = get_data(filters)
    return columns, data


def get_columns():
    return [
        {
            "label": "Date",
            "fieldname": "date",
            "fieldtype": "Date",
            "width": 180
        },
        {
            "label": "Job ID",
            "fieldname": "job",
            "fieldtype": "Link",
            "options": "Job",
            "width": 200
        },
        {
            "label": "Customer",
            "fieldname": "customer",
            "fieldtype": "Link",
            "options": "Customer",
            "width": 180
        },
        {
            "label": "Agent",
            "fieldname": "agent",
            "fieldtype": "Link",
            "options": "Agent",
            "width": 140
        },
        {
            "label": "Job Status",
            "fieldname": "job_status",
            "width": 120
        },

        {
            "label": "Mode Of Payment",
            "fieldname": "mode_of_payment",
            "fieldtype": "Link",
            "options": "Mode of Payment",
            "width": 160
        },
        {
            "label": "Sales Invoice",
            "fieldname": "sales_invoice",
            "fieldtype": "Link",
            "options": "Sales Invoice",
            "width": 190
        },
        {
            "label": "Invoice Amount",
            "fieldname": "si_amount",
            "fieldtype": "Currency",
            "width": 140
        },
        {
            "label": "Balance Amount",
            "fieldname": "si_outstanding",
            "fieldtype": "Currency",
            "width": 140
        },
        {
            "label": "Payment Entry",
            "fieldname": "payment_entry",
            "fieldtype": "Link",
            "options": "Payment Entry",
            "width": 190
        },
        {
            "label": "Paid Amount",
            "fieldname": "paid_amount",
            "fieldtype": "Currency",
            "width": 140
        }
    ]
 

def get_data(filters):
    conditions = []
    values = {}

    # Only Completed Jobs
    conditions.append("j.status = 'Completed'")

    if filters.get("from_date"):
        conditions.append("j.date >= %(from_date)s")
        values["from_date"] = filters["from_date"]

    if filters.get("to_date"):
        conditions.append("j.date <= %(to_date)s")
        values["to_date"] = filters["to_date"]

    if filters.get("job"):
        conditions.append("j.name = %(job)s")
        values["job"] = filters["job"]

    if filters.get("customer"):
        conditions.append("j.customer = %(customer)s")
        values["customer"] = filters["customer"]

    if filters.get("agent"):
        conditions.append("j.agent = %(agent)s")
        values["agent"] = filters["agent"]

    invoice_filter = filters.get("invoice_filter")

    if invoice_filter == "Sales Invoice Not Created":
        conditions.append("si.name IS NULL")

    if invoice_filter == "SI Created but Amount Not Collected":
        conditions.append("si.name IS NOT NULL AND si.outstanding_amount > 0")

    condition_str = " AND ".join(conditions)

    query = f"""
        SELECT
            j.date,
            j.name AS job,
            j.customer,
            j.agent,
            j.mode_of_payment,
            j.status AS job_status,

            si.name AS sales_invoice,
            si.grand_total AS si_amount,
            si.outstanding_amount AS si_outstanding,

            pe.name AS payment_entry,
            pe.total_allocated_amount AS paid_amount

        FROM `tabJob` j

        LEFT JOIN `tabSales Invoice` si
            ON si.job = j.name
            AND si.docstatus = 1

        LEFT JOIN `tabPayment Entry Reference` per
            ON per.reference_name = si.name

        LEFT JOIN `tabPayment Entry` pe
            ON pe.name = per.parent
            AND pe.docstatus = 1

        WHERE {condition_str}
        ORDER BY j.date DESC
    """

    return frappe.db.sql(query, values, as_dict=True)
