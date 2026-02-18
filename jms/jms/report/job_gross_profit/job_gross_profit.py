import frappe


def execute(filters=None):
    columns = get_columns()
    data = get_data(filters)
    return columns, data


# -----------------------------------------------------

def get_columns():
    return [
        {"label": "Date", "fieldname": "date", "fieldtype": "Date", "width": 100},

        {"label": "Job", "fieldname": "job", "fieldtype": "Link", "options": "Job", "width": 150},

        {"label": "Customer", "fieldname": "customer", "fieldtype": "Link", "options": "Customer", "width": 180},

        # 🔹 Sales
        # {"label": "Sales Invoice", "fieldname": "sales_invoice", "fieldtype": "Link", "options": "Sales Invoice", "width": 160},
        {"label": "Income Amount", "fieldname": "sales_amount", "fieldtype": "Currency", "width": 130},

        # {"label": "SI Payment Entry", "fieldname": "sales_pe", "fieldtype": "Link", "options": "Payment Entry", "width": 190},
        {"label": "Received Income", "fieldname": "sales_pe_amount", "fieldtype": "Currency", "width": 150},

        # 🔹 Purchase
        # {"label": "Purchase Invoice", "fieldname": "purchase_invoice", "fieldtype": "Link", "options": "Purchase Invoice", "width": 190},
        {"label": "Expense Amount", "fieldname": "purchase_amount", "fieldtype": "Currency", "width": 130},

        # {"label": "PI Payment Entry", "fieldname": "purchase_pe", "fieldtype": "Link", "options": "Payment Entry", "width": 190},
        {"label": "Paid Expense", "fieldname": "purchase_pe_amount", "fieldtype": "Currency", "width": 150},

        # 🔹 Profit
        {"label": "Gross Profit", "fieldname": "gross_profit", "fieldtype": "Currency", "width": 140},
        {"label": "Gross Profit %", "fieldname": "gross_profit_percent", "fieldtype": "Percent", "width": 140},
    ]



# -----------------------------------------------------
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

    if filters.get("customer"):
        conditions.append("j.customer = %(customer)s")
        values["customer"] = filters["customer"]

    condition_str = ""
    if conditions:
        condition_str = "WHERE " + " AND ".join(conditions)

    query = f"""
        SELECT
            j.date,
            j.name AS job,
            j.customer,

            /* ---------------- SALES (ONLY PAID) ---------------- */

            s.sales_invoice,
            s.sales_amount,
            s.sales_pe,
            s.sales_pe_amount,

            /* ---------------- PURCHASE (ONLY PAID) ---------------- */

            p.purchase_invoice,
            p.purchase_amount,
            p.purchase_pe,
            p.purchase_pe_amount

        FROM `tabJob` j

        /* ================= SALES PAID ================= */

        LEFT JOIN (
            SELECT
                si.job,

                GROUP_CONCAT(DISTINCT si.name SEPARATOR ', ') AS sales_invoice,
                SUM(per.allocated_amount) AS sales_amount,

                GROUP_CONCAT(DISTINCT pe.name SEPARATOR ', ') AS sales_pe,
                SUM(per.allocated_amount) AS sales_pe_amount

            FROM `tabSales Invoice` si

            INNER JOIN `tabPayment Entry Reference` per
                ON per.reference_name = si.name
                AND per.reference_doctype = 'Sales Invoice'

            INNER JOIN `tabPayment Entry` pe
                ON pe.name = per.parent
                AND pe.docstatus = 1

            WHERE si.docstatus = 1

            GROUP BY si.job
        ) s ON s.job = j.name

        /* ================= PURCHASE PAID ================= */

        LEFT JOIN (
            SELECT
                jt.parent AS job,

                GROUP_CONCAT(DISTINCT pi.name SEPARATOR ', ') AS purchase_invoice,
                SUM(per.allocated_amount) AS purchase_amount,

                GROUP_CONCAT(DISTINCT pe.name SEPARATOR ', ') AS purchase_pe,
                SUM(per.allocated_amount) AS purchase_pe_amount

            FROM `tabJob Task` jt

            INNER JOIN `tabPurchase Invoice` pi
                ON pi.name = jt.purchase_invoice
                AND pi.docstatus = 1

            INNER JOIN `tabPayment Entry Reference` per
                ON per.reference_name = pi.name
                AND per.reference_doctype = 'Purchase Invoice'

            INNER JOIN `tabPayment Entry` pe
                ON pe.name = per.parent
                AND pe.docstatus = 1

            GROUP BY jt.parent
        ) p ON p.job = j.name

        {condition_str}

        ORDER BY j.name DESC
    """

    data = frappe.db.sql(query, values, as_dict=True)

    # ---------------- PROFIT ----------------

    for row in data:

        sales = row.sales_amount or 0
        purchase = row.purchase_amount or 0

        gp = sales - purchase
        gp_percent = (gp / sales * 100) if sales else 0

        row["gross_profit"] = gp
        row["gross_profit_percent"] = gp_percent

    return data
