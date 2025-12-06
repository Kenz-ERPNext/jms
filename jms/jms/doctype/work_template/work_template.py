# Copyright (c) 2025, Your Company and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class WorkTemplate(Document):
	def validate(self):
		self.calculate_cost()

	def calculate_cost(self):
		"""Calculate total cost for this work template"""
		total = (self.fee_price or 0) + (self.extra or 0) + (self.surcharge or 0)
		if self.vat:
			total = total + (total * (self.vat / 100))
		self.cost = total
