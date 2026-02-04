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
            "width": 90
        },
        {
            "label": "Job ID",
            "fieldname": "job",
            "fieldtype": "Link",
            "options": "Job",
            "width": 130
        },
        {
            "label": "Customer",
            "fieldname": "customer",
            "fieldtype": "Link",
            "options": "Customer",
            "width": 150
        },
        {
            "label": "Agent",
            "fieldname": "agent",
            "fieldtype": "Link",
            "options": "Sales Person",
            "width": 120
        },
        {
            "label": "Outsourced Party",
            "fieldname": "outsourced_party",
            "fieldtype": "Link",
            "options": "Outsourced Party",
            "width": 160
        },
        {
            "label": "Purchase Invoice",
            "fieldname": "purchase_invoice",
            "fieldtype": "Link",
            "options": "Purchase Invoice",
            "width": 150
        },
        {
            "label": "Invoice Amount",
            "fieldname": "pi_total",
            "fieldtype": "Currency",
            "width": 120
        },
        {
            "label": "Invoice Balance",
            "fieldname": "pi_outstanding",
            "fieldtype": "Currency",
            "width": 130
        },
        {
            "label": "Payment Entry",
            "fieldname": "payment_entry",
            "fieldtype": "Link",
            "options": "Payment Entry",
            "width": 150
        },
        {
            "label": "Paid Amount",
            "fieldname": "paid_amount",
            "fieldtype": "Currency",
            "width": 120
        }
    ]



def get_data(filters):
    conditions = []
    values = {}

    if filters.get("from_date"):
        conditions.append("j.date >= %(from_date)s")
        values["from_date"] = filters["from_date"]

    if filters.get("to_date"):
        conditions.append("j.date <= %(to_date)s")
        values["to_date"] = filters["to_date"]

    if filters.get("job"):
        conditions.append("j.name = %(job)s")
        values["job"] = filters["job"]

    if filters.get("outsourced_party"):
        conditions.append("jt.assigned_tos = %(outsourced_party)s")
        values["outsourced_party"] = filters["outsourced_party"]

    # ✅ ONLY OUTSOURCE JOBS CHECKBOX
    if filters.get("only_outsource"):
        conditions.append("jt.assigned_tos IS NOT NULL AND jt.assigned_tos != ''")

    condition_str = ""
    if conditions:
        condition_str = " AND " + " AND ".join(conditions)

    return frappe.db.sql(
		f"""
		SELECT
			j.date AS date,
			j.name AS job,
			j.customer,
			j.agent,
			jt.assigned_tos AS outsourced_party,
			jt.purchase_invoice,
			pi.rounded_total AS pi_total,
			pi.outstanding_amount AS pi_outstanding,
			pe.name AS payment_entry,
			per.allocated_amount AS paid_amount
		FROM `tabJob` j
		LEFT JOIN `tabJob Task` jt
			ON jt.parent = j.name
		LEFT JOIN `tabPurchase Invoice` pi
			ON pi.name = jt.purchase_invoice
			AND pi.docstatus = 1
		LEFT JOIN `tabPayment Entry Reference` per
			ON per.reference_name = pi.name
			AND per.reference_doctype = 'Purchase Invoice'
		LEFT JOIN `tabPayment Entry` pe
			ON pe.name = per.parent
			AND pe.docstatus = 1
		WHERE
			j.docstatus IN (0, 1)
			{condition_str}
		ORDER BY j.date DESC
		""",
		values,
		as_dict=True
	)
