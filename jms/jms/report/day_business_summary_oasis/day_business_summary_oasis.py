


import frappe
from frappe import _
from frappe.utils import flt

def execute(filters=None):
    filters = filters or {}
    data = []
    columns = get_columns()

    # Define HTML color styles
    sales_style = 'background-color:#d1f2eb; font-weight:bold;'     # soft green-blue
    purchase_style = 'background-color:#f5b7b1; font-weight:bold;'  # light coral red
    neutral_style = 'background-color:#d6eaf8; font-weight:bold;'   # pale blue
    red_style = 'background-color:#71FC0F; font-weight:bold;'       # bright lime green

    # Define sections with matching colors
    sections = [
        ("Sales Summary", get_sales_summary(filters), sales_style),
        ("Purchase Summary", get_purchase_summary(filters), purchase_style),
        ("Sales Details", get_sales_details(filters), sales_style),
        ("Sales Return Details", get_sales_return_details(filters), sales_style),
        ("Purchase Details", get_purchase_details(filters), purchase_style),
        ("Purchase Return", get_purchase_return(filters), purchase_style),
        ("Cash & Bank Summary", get_cash_bank_summary(filters), neutral_style),
        ("Receipts", get_receipt_details(filters), neutral_style),
        ("Payments", get_payment_details(filters), red_style),
        ("Contra (Journal Entry)", get_contra_details(filters), neutral_style)
    ]

    for title, rows, style in sections:
        data.append({
            "sl_no": "",
            "voucher_no": f"<div style='{style}'>&nbsp;▶ {title}</div>",
            "particulars": "",
            "reference": "",
            "cash": "",
            "bank": "",
            "cheque": "",
            "total": "",
            "account": ""
        })

        if not rows:
            data.append({
                "voucher_no": "No records found",
                "total": ""
            })
        else:
            for r in rows:
                if "Total" in str(r.get("voucher_no", "")):
                    r["voucher_no"] = f"<b>{r['voucher_no']}</b>"
                    r["total"] = f"<b>{flt(r['total'], 2)}</b>"
                data.append(r)

        data.append({
            "sl_no": "",
            "voucher_no": "",
            "particulars": "",
            "reference": "",
            "cash": "",
            "bank": "",
            "cheque": "",
            "total": "",
            "account": ""
        })

    return columns, data


# -------------------------------
# Column Setup
# -------------------------------

def get_columns():
    return [
        {"label": _("SL No"), "fieldname": "sl_no", "fieldtype": "Int", "width": 50},
        {"label": _("Voucher / Invoice No"), "fieldname": "voucher_no", "fieldtype": "Data", "width": 200},
        {"label": _("Particulars"), "fieldname": "particulars", "fieldtype": "Data", "width": 200},
        {"label": _("Reference"), "fieldname": "reference", "fieldtype": "Data", "width": 100},
        {"label": _("Cash"), "fieldname": "cash", "fieldtype": "Currency", "width": 100},
        {"label": _("Bank"), "fieldname": "bank", "fieldtype": "Currency", "width": 100},
        {"label": _("Cheque"), "fieldname": "cheque", "fieldtype": "Currency", "width": 100},
        {"label": _("Total Amount"), "fieldname": "total", "fieldtype": "Currency", "width": 120},
        # {"label": _("Account / Sales By"), "fieldname": "account", "fieldtype": "Data", "width": 150},
    ]


# -------------------------------
# Data Queries
# -------------------------------

def get_sales_summary(filters):
    company = filters.get("company")
    posting_date = filters.get("posting_date")

    def get_value(query):
        value = frappe.db.sql(query, {"company": company, "posting_date": posting_date})
        return flt(value[0][0]) if value and value[0][0] is not None else 0.0

    cash_sales = get_value("""
        SELECT SUM(si.base_grand_total)
        FROM `tabSales Invoice` si
        JOIN `tabPayment Entry Reference` per ON per.reference_name = si.name
        JOIN `tabPayment Entry` pe ON pe.name = per.parent
        WHERE pe.docstatus = 1 AND pe.mode_of_payment = 'Cash'
        AND si.is_return = 0 AND si.company = %(company)s
        AND si.posting_date = %(posting_date)s
    """)

    bank_sales = get_value("""
        SELECT SUM(si.base_grand_total)
        FROM `tabSales Invoice` si
        JOIN `tabPayment Entry Reference` per ON per.reference_name = si.name
        JOIN `tabPayment Entry` pe ON pe.name = per.parent
        WHERE pe.docstatus = 1 AND pe.mode_of_payment = 'Bank'
        AND si.is_return = 0 AND si.company = %(company)s
        AND si.posting_date = %(posting_date)s
    """)

    credit_sales = get_value("""
        SELECT SUM(base_grand_total)
        FROM `tabSales Invoice` si
        WHERE si.docstatus = 1 AND si.is_return = 0
        AND si.company = %(company)s
        AND si.posting_date = %(posting_date)s
        AND si.name NOT IN (
            SELECT reference_name FROM `tabPayment Entry Reference`
            WHERE reference_doctype = 'Sales Invoice'
        )
    """)

    sales_return_cash = get_value("""
        SELECT SUM(si.base_grand_total)
        FROM `tabSales Invoice` si
        JOIN `tabPayment Entry Reference` per ON per.reference_name = si.name
        JOIN `tabPayment Entry` pe ON pe.name = per.parent
        WHERE pe.docstatus = 1 AND pe.mode_of_payment = 'Cash'
        AND si.is_return = 1 AND si.company = %(company)s
        AND si.posting_date = %(posting_date)s
    """)

    sales_return_credit = get_value("""
        SELECT SUM(base_grand_total)
        FROM `tabSales Invoice` si
        WHERE si.docstatus = 1 AND si.is_return = 1
        AND si.company = %(company)s
        AND si.posting_date = %(posting_date)s
        AND si.name NOT IN (
            SELECT reference_name FROM `tabPayment Entry Reference`
            WHERE reference_doctype = 'Sales Invoice'
        )
    """)

    total_sales = (cash_sales + credit_sales + bank_sales) - (sales_return_cash + sales_return_credit)

    # Always return list (even if all are zero)


    return [
		{"voucher_no": "Cash Sales", "total": cash_sales or 0},
		{"voucher_no": "Credit Sales", "total": credit_sales or 0},
		{"voucher_no": "Bank Sales", "total": bank_sales or 0},
		{"voucher_no": "Sales Return - Cash", "total": sales_return_cash or 0},
		{"voucher_no": "Sales Return - Credit", "total": sales_return_credit or 0},
		{"voucher_no": "Total Net Sales", "total": total_sales or 0},
	]	

def get_purchase_summary(filters):
    company = filters.get("company")
    posting_date = filters.get("posting_date")

    cash_purchase = frappe.db.sql("""
        SELECT IFNULL(SUM(pi.base_grand_total), 0)
        FROM `tabPurchase Invoice` pi
        JOIN `tabPayment Entry Reference` per ON per.reference_name = pi.name
        JOIN `tabPayment Entry` pe ON pe.name = per.parent
        WHERE pe.docstatus = 1 AND pe.mode_of_payment = 'Cash'
        AND pi.is_return = 0
        AND pi.company = %(company)s
        AND pi.posting_date = %(posting_date)s
    """, {"company": company, "posting_date": posting_date})[0][0]

    bank_purchase = frappe.db.sql("""
        SELECT IFNULL(SUM(pi.base_grand_total), 0)
        FROM `tabPurchase Invoice` pi
        JOIN `tabPayment Entry Reference` per ON per.reference_name = pi.name
        JOIN `tabPayment Entry` pe ON pe.name = per.parent
        WHERE pe.docstatus = 1 AND pe.mode_of_payment = 'Bank'
        AND pi.is_return = 0
        AND pi.company = %(company)s
        AND pi.posting_date = %(posting_date)s
    """, {"company": company, "posting_date": posting_date})[0][0]

    credit_purchase = frappe.db.sql("""
        SELECT IFNULL(SUM(base_grand_total), 0)
        FROM `tabPurchase Invoice` pi
        WHERE pi.docstatus = 1 AND pi.is_return = 0
        AND pi.company = %(company)s
        AND pi.posting_date = %(posting_date)s
        AND pi.name NOT IN (
            SELECT reference_name FROM `tabPayment Entry Reference`
            WHERE reference_doctype = 'Purchase Invoice'
        )
    """, {"company": company, "posting_date": posting_date})[0][0]

    purchase_return_cash = frappe.db.sql("""
        SELECT IFNULL(SUM(pi.base_grand_total), 0)
        FROM `tabPurchase Invoice` pi
        JOIN `tabPayment Entry Reference` per ON per.reference_name = pi.name
        JOIN `tabPayment Entry` pe ON pe.name = per.parent
        WHERE pe.docstatus = 1 AND pe.mode_of_payment = 'Cash'
        AND pi.is_return = 1
        AND pi.company = %(company)s
        AND pi.posting_date = %(posting_date)s
    """, {"company": company, "posting_date": posting_date})[0][0]

    purchase_return_credit = frappe.db.sql("""
        SELECT IFNULL(SUM(base_grand_total), 0)
        FROM `tabPurchase Invoice` pi
        WHERE pi.docstatus = 1 AND pi.is_return = 1
        AND pi.company = %(company)s
        AND pi.posting_date = %(posting_date)s
        AND pi.name NOT IN (
            SELECT reference_name FROM `tabPayment Entry Reference`
            WHERE reference_doctype = 'Purchase Invoice'
        )
    """, {"company": company, "posting_date": posting_date})[0][0]

    # ✅ Correct total calculation
    total_net_purchase = (cash_purchase + credit_purchase + bank_purchase) - (purchase_return_cash + purchase_return_credit)

    return [
        {"voucher_no": "Cash Purchases", "total": cash_purchase},
        {"voucher_no": "Credit Purchases", "total": credit_purchase},
        {"voucher_no": "Bank Purchases", "total": bank_purchase},
        {"voucher_no": "Purchase Return - Cash", "total": purchase_return_cash},
        {"voucher_no": "Purchase Return - Credit", "total": purchase_return_credit},
        {"voucher_no": "Total Net Purchases", "total": total_net_purchase}
    ]



def get_cash_bank_summary(filters):
    return frappe.db.sql("""
        SELECT
            row_number() over() AS sl_no,
            account AS voucher_no,
            '' AS particulars,
            '' AS reference,
            SUM(debit) AS cash,
            SUM(credit) AS bank,
            0 AS cheque,
            (SUM(debit) - SUM(credit)) AS total,
            '' AS account
        FROM `tabGL Entry`
        WHERE posting_date = %(posting_date)s
            AND company = %(company)s
            AND account IN ('Cash', 'Bank')
        GROUP BY account
    """, filters, as_dict=True)
 

def get_sales_details(filters):
    return frappe.db.sql("""
        SELECT
            row_number() over() AS sl_no,
            CONCAT(si.name, ' / ', IFNULL(si.job, '')) AS voucher_no,
            si.customer AS particulars,
            '' AS reference,
            CASE WHEN si.is_pos = 1 THEN si.grand_total ELSE 0 END AS cash,
            0 AS bank,
            0 AS cheque,
            si.grand_total AS total,
            si.owner AS account
        FROM `tabSales Invoice` si
        WHERE si.docstatus = 1
            AND si.is_return = 0
            AND si.posting_date = %(posting_date)s
            AND si.company = %(company)s
    """, filters, as_dict=True)

# def get_sales_details(filters):
#     return frappe.db.sql("""
#         SELECT
#             row_number() over() AS sl_no,
#             si.name AS voucher_no,
#             si.customer AS particulars,
#             '' AS reference,
#             CASE WHEN si.is_pos = 1 THEN si.grand_total ELSE 0 END AS cash,
#             0 AS bank,
#             0 AS cheque,
#             si.grand_total AS total,
#             si.owner AS account
#         FROM `tabSales Invoice` si
#         WHERE si.docstatus = 1
#             AND si.is_return = 0
#             AND si.posting_date = %(posting_date)s
#             AND si.company = %(company)s
#     """, filters, as_dict=True)


def get_sales_return_details(filters):
    return frappe.db.sql("""
        SELECT
            row_number() over() AS sl_no,
            si.name AS voucher_no,
            si.customer AS particulars,
            si.return_against AS reference,
            0 AS cash,
            0 AS bank,
            0 AS cheque,
            si.grand_total AS total,
            '' AS account
        FROM `tabSales Invoice` si
        WHERE si.docstatus = 1
            AND si.is_return = 1
            AND si.posting_date = %(posting_date)s
            AND si.company = %(company)s
    """, filters, as_dict=True)

def get_purchase_details(filters):
    return frappe.db.sql("""
        SELECT
            row_number() over() AS sl_no,
            CONCAT(pi.name, ' / ', IFNULL(pi.job, '')) AS voucher_no,
            pi.supplier AS particulars,
            pi.bill_no AS reference,
            0 AS cash,
            0 AS bank,
            0 AS cheque,
            pi.grand_total AS total,
            '' AS account
        FROM `tabPurchase Invoice` pi
        WHERE pi.docstatus = 1
            AND pi.is_return = 0
            AND pi.posting_date = %(posting_date)s
            AND pi.company = %(company)s
    """, filters, as_dict=True)

# def get_purchase_details(filters):
#     return frappe.db.sql("""
#         SELECT
#             row_number() over() AS sl_no,
#             pi.name AS voucher_no,
#             pi.supplier AS particulars,
#             pi.bill_no AS reference,
#             0 AS cash,
#             0 AS bank,
#             0 AS cheque,
#             pi.grand_total AS total,
#             '' AS account
#         FROM `tabPurchase Invoice` pi
#         WHERE pi.docstatus = 1
#             AND pi.is_return = 0
#             AND pi.posting_date = %(posting_date)s
#             AND pi.company = %(company)s
#     """, filters, as_dict=True)


def get_purchase_return(filters):
    return frappe.db.sql("""
        SELECT
            row_number() over() AS sl_no,
            pi.name AS voucher_no,
            pi.supplier AS particulars,
            pi.return_against AS reference,
            0 AS cash,
            0 AS bank,
            0 AS cheque,
            pi.grand_total AS total,
            '' AS account
        FROM `tabPurchase Invoice` pi
        WHERE pi.docstatus = 1
            AND pi.is_return = 1
            AND pi.posting_date = %(posting_date)s
            AND pi.company = %(company)s
    """, filters, as_dict=True)

def get_receipt_details(filters):
    return frappe.db.sql("""
        SELECT
            row_number() over() AS sl_no,
            CONCAT(pe.name, ' / ', IFNULL(si.job, pi.job, '')) AS voucher_no,
            pe.party AS particulars,
            per.reference_name AS reference,
            CASE WHEN pe.paid_to LIKE '%%Cash%%' THEN pe.paid_amount ELSE 0 END AS cash,
            CASE WHEN pe.paid_to LIKE '%%Bank%%' THEN pe.paid_amount ELSE 0 END AS bank,
            0 AS cheque,
            pe.paid_amount AS total,
            pe.paid_to AS account
        FROM `tabPayment Entry` pe
        LEFT JOIN `tabPayment Entry Reference` per ON per.parent = pe.name
        LEFT JOIN `tabSales Invoice` si ON si.name = per.reference_name
        LEFT JOIN `tabPurchase Invoice` pi ON pi.name = per.reference_name
        WHERE pe.docstatus = 1
            AND pe.payment_type = 'Receive'
            AND pe.posting_date = %(posting_date)s
            AND pe.company = %(company)s
    """, filters, as_dict=True)
# def get_receipt_details(filters):
#     return frappe.db.sql("""
#         SELECT
#             row_number() over() AS sl_no,
#             pe.name AS voucher_no,
#             pe.party AS particulars,
#             '' AS reference,
#             CASE WHEN pe.paid_to LIKE '%%Cash%%' THEN pe.paid_amount ELSE 0 END AS cash,
#             CASE WHEN pe.paid_to LIKE '%%Bank%%' THEN pe.paid_amount ELSE 0 END AS bank,
#             0 AS cheque,
#             pe.paid_amount AS total,
#             pe.paid_to AS account
#         FROM `tabPayment Entry` pe
#         WHERE pe.docstatus = 1
#             AND pe.payment_type = 'Receive'
#             AND pe.posting_date = %(posting_date)s
#             AND pe.company = %(company)s
#     """, filters, as_dict=True)

def get_payment_details(filters):
    return frappe.db.sql("""
        SELECT
            row_number() over() AS sl_no,
            CONCAT(pe.name, ' / ', IFNULL(si.job, pi.job, '')) AS voucher_no,
            pe.party AS particulars,
            per.reference_name AS reference,
            CASE WHEN pe.paid_from LIKE '%%Cash%%' THEN pe.paid_amount ELSE 0 END AS cash,
            CASE WHEN pe.paid_from LIKE '%%Bank%%' THEN pe.paid_amount ELSE 0 END AS bank,
            0 AS cheque,
            pe.paid_amount AS total,
            pe.paid_from AS account
        FROM `tabPayment Entry` pe
        LEFT JOIN `tabPayment Entry Reference` per ON per.parent = pe.name
        LEFT JOIN `tabSales Invoice` si ON si.name = per.reference_name
        LEFT JOIN `tabPurchase Invoice` pi ON pi.name = per.reference_name
        WHERE pe.docstatus = 1
            AND pe.payment_type = 'Pay'
            AND pe.posting_date = %(posting_date)s
            AND pe.company = %(company)s
    """, filters, as_dict=True)
    
# def get_payment_details(filters):
#     return frappe.db.sql("""
#         SELECT
#             row_number() over() AS sl_no,
#             pe.name AS voucher_no,
#             pe.party AS particulars,
#             '' AS reference,
#             CASE WHEN pe.paid_from LIKE '%%Cash%%' THEN pe.paid_amount ELSE 0 END AS cash,
#             CASE WHEN pe.paid_from LIKE '%%Bank%%' THEN pe.paid_amount ELSE 0 END AS bank,
#             0 AS cheque,
#             pe.paid_amount AS total,
#             pe.paid_from AS account
#         FROM `tabPayment Entry` pe
#         WHERE pe.docstatus = 1
#             AND pe.payment_type = 'Pay'
#             AND pe.posting_date = %(posting_date)s
#             AND pe.company = %(company)s
#     """, filters, as_dict=True)


def get_contra_details(filters):
    return frappe.db.sql("""
        SELECT
            row_number() over() AS sl_no,
            je.name AS voucher_no,
            a.account AS particulars,
            '' AS reference,
            a.credit AS cash,
            a.debit AS bank,
            0 AS cheque,
            (a.debit + a.credit) AS total,
            je.user_remark AS account
        FROM `tabJournal Entry` je
        JOIN `tabJournal Entry Account` a ON a.parent = je.name
        WHERE je.docstatus = 1
            AND je.posting_date = %(posting_date)s
            AND je.company = %(company)s
    """, filters, as_dict=True)








