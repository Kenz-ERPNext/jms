import frappe

@frappe.whitelist()
def backend_process():
    return "Backend Function Running Successfully!"
