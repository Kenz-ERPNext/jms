# Copyright (c) 2026, sammish and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class ExpenseType(Document):
	

	@frappe.whitelist()
	def validate(self):
		if not frappe.db.exists("Item", self.expense_type):
			item = frappe.new_doc("Item")
			item.item_code = self.expense_type
			item.item_name = self.expense_type
			item.item_group = "Expense"   
			item.stock_uom = "Nos"
			item.is_stock_item = 0
			item.disabled = 0

			item.insert(ignore_permissions=True)
			item.save()

			self.item = item.item_code

 