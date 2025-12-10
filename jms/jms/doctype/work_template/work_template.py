# Copyright (c) 2025, Your Company and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
 

class WorkTemplate(Document):
	def validate(self):
		self.calculate_cost()
		self.create_item()
		self.create_task()   

	def calculate_cost(self):
		"""Calculate total cost for this work template"""
		total = (self.fee_price or 0) + (self.extra or 0) + (self.surcharge or 0)
		if self.vat:
			total = total + (total * (self.vat / 100))
		self.cost = total
	
	@frappe.whitelist() 
	def create_item(self):
		if frappe.db.exists("Item", self.item_code):
			return

		# Create new item
		item = frappe.new_doc("Item")
		item.item_code = self.template_code
		item.item_name = self.template_code or self.template_code
		item.item_group = "Services"
		item.description = self.description
		item.stock_uom = "Nos"               
		item.is_stock_item = 0                
		item.is_sales_item = 1
		item.is_purchase_item = 1

		# Save item
		item.insert(ignore_permissions=True)

		self.item_code = item.item_code 

		frappe.msgprint(f"New Item Created: <b>{self.item_code}</b>")


	@frappe.whitelist() 
	def create_task(self):

		if self.has_sub_tasks:

			for row in self.sub_tasks:
				task_name = row.task_name

				if not task_name:
					continue

				if frappe.db.exists("Task", {"subject": task_name}):
					continue

				task = frappe.new_doc("Task")
				task.subject = task_name
				task.status = self.status			
				task.description = f"Auto-created from Work Template {self.name}"
				task.insert(ignore_permissions=True)
				row.linked_task = task.name

				frappe.msgprint(f"Task <b>{task_name}</b> created.")

		else:

			if frappe.db.exists("Task", {"subject": self.template_code}):
				return

			task = frappe.new_doc("Task")
			task.subject = self.template_code
			task.status = self.status
			task.description = f"Auto-created from Work Template {self.name}"
			task.insert(ignore_permissions=True)

			self.task = task.name

			frappe.msgprint(f"Task <b>{self.template_code}</b> created.")


			# row = self.append("sub_tasks", {})
			# row.task_name = self.template_code
			# row.linked_task = task.name

			# self.save(ignore_permissions=True)


	@frappe.whitelist() 
	def vat_rate(self):
		self.vat = 0  
		if not self.tax_templates:
			return

		stc_template = frappe.get_doc("Sales Taxes and Charges Template", self.tax_templates)

	
		for tax in stc_template.taxes:
			if tax.rate:
				self.vat = tax.rate



