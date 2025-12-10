# Copyright (c) 2025, Your Company and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class Agent(Document):
	
	@frappe.whitelist()
	def validate(self):
		# pass

		if self.linked_customer:
			return

		cus = frappe.new_doc("Customer")
		cus.customer_name = self.agent_name
		cus.customer_type = "Individual"  
		if self.tax_id:
			cus.tax_id = self.tax_id
			cus.custom_vat_registration_number = self.tax_id

		cus.custom_agent = 1


		cus.flags.ignore_permissions = True
		cus.insert()
		cus.save()

		self.linked_customer = cus.name
 