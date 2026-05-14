# Copyright (c) 2025, Your Company and contributors
# For license information, please see license.txt
 
import frappe
from frappe import _
from frappe.utils import flt
from frappe.model.document import Document
from frappe.utils import add_days, date_diff, getdate, today, nowdate


class Job(Document):
	def validate(self):
		self.set_year()
		# self.validate_customer_or_agent()
		# self.create_customer_from_agent_if_required()
		self.validate_staff_assignment()
		self.calculate_amounts()
		self.calculate_agent_commission()
		self.set_expected_completion_date()
		self.check_overdue()
		self.auto_create_tasks_from_items()



 



	def after_insert(self):
		pass 

	def set_year(self):
		"""Set year from date field"""
		if self.date:
			self.year = getdate(self.date).year


	def validate_staff_assignment(self):
		"""Validate that only one staff is marked as primary"""
		if not self.staff_assignment:
			return

		primary_count = sum(1 for staff in self.staff_assignment if staff.is_primary)

		if primary_count > 1:
			frappe.throw(_("Only one staff member can be marked as Primary"))


	def calculate_amounts(self):

		# pass
		"""Calculate gross amount, net amount, and balance"""

		gross_total = 0          
		net_total = 0            

		for item in self.items:

			fee_price = item.fee_price or 0
			extra = item.extra or 0
			surcharge = item.surcharge or 0
			qty = item.job_qty or 1

			total_without_tax = (fee_price + extra + surcharge) * qty
			item.total_without_tax = total_without_tax

			gross_total += total_without_tax

			if item.vat:
				item.vat_amount = total_without_tax * (item.vat / 100)
				item.total = total_without_tax + item.vat_amount
			else:
				item.vat_amount = 0
				item.total = total_without_tax

			net_total += item.total

		self.gross_amount = gross_total

		self.net_amount = net_total

		self.balance = (self.net_amount or 0) - (self.discount or 0)




	def calculate_agent_commission(self):
		"""Calculate agent commission based on agent settings"""
		if not self.agent or not self.net_amount:
			self.agent_commission = 0
			return

		agent = frappe.get_doc("Agent", self.agent)

		if agent.commission_type == "Percentage":
			self.agent_commission = (self.net_amount * agent.commission_rate) / 100
		elif agent.commission_type == "Fixed Amount":
			self.agent_commission = agent.commission_rate

	def set_expected_completion_date(self):
		"""Set expected completion date based on job type default duration"""
		if not self.expected_completion_date and self.start_date and self.job_type:
			job_type = frappe.get_doc("Job Type", self.job_type)
			if job_type.default_duration_days:
				self.expected_completion_date = add_days(self.start_date, job_type.default_duration_days)

	def check_overdue(self):
		"""Check if job is overdue"""
		if self.expected_completion_date and not self.completion_date:
			if getdate(nowdate()) > getdate(self.expected_completion_date):
				self.overdue_status = "Overdue"
			else:
				self.overdue_status = "On Time"
		elif self.completion_date:
			if getdate(self.completion_date) > getdate(self.expected_completion_date):
				self.overdue_status = "Overdue"
			else:
				self.overdue_status = "On Time"





	@frappe.whitelist()
	def auto_create_tasks_from_items(self):
		"""Auto-create tasks from work template sub tasks or single task field"""
		if not self.items:
			return

		# Clear existing tasks if this is a new creation
		if self.is_new():
			self.tasks = []

		for item in self.items:
			if not item.work_template:
				continue

			# Get work template
			work_template = frappe.get_doc("Work Template", item.work_template)

			# 1️⃣ If work template has sub_tasks
			if work_template.has_sub_tasks and work_template.sub_tasks:
				for sub_task in work_template.sub_tasks:
					# Check if task already exists
					existing_task = any(
						existing.task_name == f"{work_template.description} - {sub_task.task_name}"
						for existing in self.tasks
					)
					if not existing_task:
						due_date = add_days(self.start_date, sub_task.due_days or 0)
						self.append("tasks", {
							"task_name": f"{work_template.description} - {sub_task.task_name}",
							# "assigned_to": sub_task.assigned_to,
							"due_date": due_date,
							"status": sub_task.status or "Pending",
							"linked_task": sub_task.linked_task,
							"item_code" :item.item_code
						})

			# 2️⃣ If no sub_tasks but single task field exists
			elif getattr(work_template, "task", None):
				task_name = f"{work_template.description} - {work_template.task}"
				# Check if already exists
				if not any(existing.task_name == task_name for existing in self.tasks):
					due_date = self.start_date  # Or calculate differently if needed
					self.append("tasks", {
						"task_name": task_name,
						# "assigned_to": getattr(work_template, "assigned_to", None),
						"due_date": due_date,
						"status": getattr(work_template, "status", "Pending"),
						"linked_task": getattr(work_template, "linked_task", None),
						"item_code" :item.item_code
					})




	def get_progress(self):
		"""Calculate job progress based on completed tasks"""
		if not self.tasks:
			return 0

		total_tasks = len(self.tasks)
		completed_tasks = len([task for task in self.tasks if task.status == "Completed"])

		return round((completed_tasks / total_tasks) * 100, 2) if total_tasks else 0

	def before_cancel(self):
		"""Validate before cancelling job"""
		if self.status == "COMPLETED":
			frappe.throw(_("Cannot cancel a completed job"))

		if self.linked_invoice:
			invoice = frappe.get_doc("Sales Invoice", self.linked_invoice)
			if invoice.docstatus == 1:
				frappe.throw(_("Cannot cancel job with submitted invoice. Please cancel invoice first."))

	def on_trash(self):
		"""Validate before deleting job"""
		if self.status in ["COMPLETED", "CANCELED", "REJECTED"]:
			frappe.throw(_("Cannot delete jobs with status {0}").format(self.status))

		if self.linked_invoice:
			frappe.throw(_("Cannot delete job linked to invoice. Please remove invoice link first."))


	@frappe.whitelist()
	def get_job_progress(job_name):
		"""API method to get job progress"""
		job = frappe.get_doc("Job", job_name)
		return {
			"progress": job.get_progress(),
			"total_tasks": len(job.tasks),
			"completed_tasks": len([task for task in job.tasks if task.status == "Completed"]),
			"pending_tasks": len([task for task in job.tasks if task.status == "Pending"]),
			"in_progress_tasks": len([task for task in job.tasks if task.status == "In Progress"])
		}

# PAYMNET ENTRY CREATION CODE 


	
	# @frappe.whitelist()
	# def create_invoice(self, tax_template=None, payment_type=None, partial_amount=None):

	# 	# ------------------------------------------------
	# 	# CREATE SALES INVOICE
	# 	# ------------------------------------------------

	# 	sales_invoice = frappe.new_doc("Sales Invoice")

	# 	if self.receivable_from == "Customer":
	# 		sales_invoice.customer = self.customer
	# 	else:
	# 		sales_invoice.customer = self.agent_customer

	# 	sales_invoice.company = frappe.defaults.get_user_default("company")

	# 	sales_invoice.posting_date = frappe.utils.nowdate()

	# 	sales_invoice.due_date = frappe.utils.add_days(
	# 		frappe.utils.nowdate(),
	# 		30
	# 	)

	# 	sales_invoice.custom_job = self.name

	# 	sales_invoice.disable_rounded_total = 1

	# 	sales_invoice.job = self.name

	# 	# ------------------------------------------------
	# 	# TAX TEMPLATE
	# 	# ------------------------------------------------

	# 	if tax_template:

	# 		sales_invoice.taxes_and_charges = tax_template

	# 		sales_invoice.set_taxes()

	# 	# ------------------------------------------------
	# 	# ITEMS
	# 	# ------------------------------------------------

	# 	if self.items:

	# 		for row in self.items:

	# 			sales_invoice.append("items", {
	# 				"item_code": row.item_code,
	# 				"description": row.description,
	# 				"qty": row.job_qty,
	# 				"rate": row.total_without_tax,
	# 				"job": self.name
	# 			})

	# 	# ------------------------------------------------
	# 	# CALCULATE TOTALS
	# 	# ------------------------------------------------

	# 	sales_invoice.run_method("calculate_taxes_and_totals")

	# 	# ------------------------------------------------
	# 	# INSERT ONLY
	# 	# ------------------------------------------------

	# 	sales_invoice.insert(ignore_permissions=True)

	# 	# ------------------------------------------------
	# 	# FETCH ADVANCE PAYMENTS
	# 	# ------------------------------------------------

	# 	sales_invoice.set_advances()

	# 	total_allocated_advance = 0

	# 	if sales_invoice.advances:

	# 		for row in sales_invoice.advances:

	# 			if flt(row.advance_amount) <= 0:
	# 				continue

	# 			remaining_amount = (
	# 				flt(sales_invoice.grand_total)
	# 				- flt(total_allocated_advance)
	# 			)

	# 			if remaining_amount <= 0:
	# 				break

	# 			allocated_amount = min(
	# 				flt(row.advance_amount),
	# 				remaining_amount
	# 			)

	# 			row.allocated_amount = allocated_amount

	# 			total_allocated_advance += allocated_amount

	# 	# ------------------------------------------------
	# 	# SAVE ADVANCE ROWS
	# 	# ------------------------------------------------

	# 	sales_invoice.save(ignore_permissions=True)

	# 	# ------------------------------------------------
	# 	# SUBMIT INVOICE
	# 	# ------------------------------------------------

	# 	sales_invoice.submit()

	# 	# ------------------------------------------------
	# 	# REMAINING BALANCE
	# 	# ------------------------------------------------

	# 	remaining_amount = flt(sales_invoice.grand_total) - flt(total_allocated_advance)

	# 	if remaining_amount < 0:
	# 		remaining_amount = 0

	# 	# ------------------------------------------------
	# 	# UPDATE JOB
	# 	# ------------------------------------------------

	# 	self.sales_invoice_status = "Created"

	# 	self.linked_invoice = sales_invoice.name

	# 	self.save(ignore_permissions=True)

	# 	# ------------------------------------------------
	# 	# CREATE BALANCE PAYMENT ENTRY
	# 	# ------------------------------------------------

	# 	if (
	# 		self.payment == "Payment Now"
	# 		and remaining_amount > 0
	# 	):

	# 		payment_entry = frappe.new_doc("Payment Entry")

	# 		payment_entry.payment_type = "Receive"

	# 		payment_entry.company = sales_invoice.company

	# 		payment_entry.posting_date = frappe.utils.nowdate()

	# 		payment_entry.mode_of_payment = self.mode_of_payment

	# 		payment_entry.party_type = "Customer"

	# 		payment_entry.party = sales_invoice.customer

	# 		payment_entry.custom_job = self.name

	# 		payment_entry.job = self.name

	# 		payment_entry.reference_no = self.name

	# 		payment_entry.reference_date = frappe.utils.nowdate()

	# 		# ------------------------------------------------
	# 		# ACCOUNT FETCH
	# 		# ------------------------------------------------

	# 		if self.mode_of_payment in [
	# 			"Bank",
	# 			"Bank Draft",
	# 			"Bank Transfer",
	# 			"RIYAD BANK"
	# 		]:

	# 			default_bank_account = frappe.db.get_value(
	# 				"Company",
	# 				sales_invoice.company,
	# 				"default_bank_account"
	# 			)

	# 			if not default_bank_account:

	# 				frappe.throw(
	# 					f"Default bank account is not set "
	# 					f"for company: {sales_invoice.company}"
	# 				)

	# 			payment_entry.paid_to = default_bank_account

	# 			payment_entry.reference_no = self.name

	# 			payment_entry.reference_date = frappe.utils.nowdate()

	# 		else:

	# 			payment_entry.paid_to = frappe.db.get_value(
	# 				"Mode of Payment Account",
	# 				{
	# 					"parent": self.mode_of_payment,
	# 					"company": sales_invoice.company
	# 				},
	# 				"default_account"
	# 			)

	# 			if not payment_entry.paid_to:

	# 				frappe.throw(
	# 					f"No account found for Mode of Payment: "
	# 					f"{self.mode_of_payment}"
	# 				)

	# 		# ------------------------------------------------
	# 		# PAYMENT AMOUNT
	# 		# ------------------------------------------------

	# 		if payment_type == "Partially Paid":

	# 			paid_amount = flt(partial_amount or 0)

	# 			if paid_amount <= 0:

	# 				frappe.throw(
	# 					"Partial amount must be greater than 0"
	# 				)

	# 			if paid_amount > remaining_amount:

	# 				frappe.throw(
	# 					"Partial amount cannot exceed "
	# 					"Remaining Amount"
	# 				)

	# 		else:

	# 			paid_amount = remaining_amount

	# 		# ------------------------------------------------
	# 		# REFERENCE
	# 		# ------------------------------------------------

	# 		payment_entry.append("references", {
	# 			"reference_doctype": "Sales Invoice",
	# 			"reference_name": sales_invoice.name,
	# 			"total_amount": sales_invoice.grand_total,
	# 			"outstanding_amount": remaining_amount,
	# 			"allocated_amount": paid_amount,
	# 			"job": self.name
	# 		})

	# 		payment_entry.paid_amount = paid_amount

	# 		payment_entry.received_amount = paid_amount

	# 		payment_entry.insert(ignore_permissions=True)

	# 		payment_entry.submit()

	# 		# ------------------------------------------------
	# 		# UPDATE JOB PAYMENT ENTRY
	# 		# ------------------------------------------------

	# 		self.sales_invoice_payment_entry = payment_entry.name

	# 		self.save(ignore_permissions=True)

	# 		return payment_entry.name

	# 	return sales_invoice.name

	@frappe.whitelist()
	def create_invoice(
		self,
		tax_template=None,
		payment_type=None,
		partial_amount=None,
		reference_no=None,
		reference_date=None
	):

		# ------------------------------------------------
		# CREATE SALES INVOICE
		# ------------------------------------------------

		sales_invoice = frappe.new_doc("Sales Invoice")

		if self.receivable_from == "Customer":

			sales_invoice.customer = self.customer

		else:

			sales_invoice.customer = self.agent_customer

		sales_invoice.company = frappe.defaults.get_user_default(
			"company"
		)

		sales_invoice.posting_date = frappe.utils.nowdate()

		sales_invoice.due_date = frappe.utils.add_days(
			frappe.utils.nowdate(),
			30
		)

		sales_invoice.custom_job = self.name

		sales_invoice.disable_rounded_total = 1

		sales_invoice.job = self.name

		# ------------------------------------------------
		# TAX TEMPLATE
		# ------------------------------------------------

		if tax_template:

			sales_invoice.taxes_and_charges = tax_template

			sales_invoice.set_taxes()

		# ------------------------------------------------
		# ITEMS
		# ------------------------------------------------

		if self.items:

			for row in self.items:

				sales_invoice.append("items", {

					"item_code": row.item_code,

					"description": row.description,

					"qty": row.job_qty,

					"rate": row.total_without_tax,

					"job": self.name
				})

		# ------------------------------------------------
		# CALCULATE TOTALS
		# ------------------------------------------------

		sales_invoice.run_method(
			"calculate_taxes_and_totals"
		)

		# ------------------------------------------------
		# INSERT ONLY
		# ------------------------------------------------

		sales_invoice.insert(ignore_permissions=True)

		# ------------------------------------------------
		# FETCH ADVANCE PAYMENTS
		# ------------------------------------------------

		sales_invoice.set_advances()

		total_allocated_advance = 0

		if sales_invoice.advances:

			for row in sales_invoice.advances:

				if flt(row.advance_amount) <= 0:
					continue

				remaining_amount = (
					flt(sales_invoice.grand_total)
					- flt(total_allocated_advance)
				)

				if remaining_amount <= 0:
					break

				allocated_amount = min(
					flt(row.advance_amount),
					remaining_amount
				)

				row.allocated_amount = allocated_amount

				total_allocated_advance += allocated_amount

		# ------------------------------------------------
		# SAVE ADVANCE ROWS
		# ------------------------------------------------

		sales_invoice.save(ignore_permissions=True)

		# ------------------------------------------------
		# SUBMIT INVOICE
		# ------------------------------------------------

		sales_invoice.submit()

		# ------------------------------------------------
		# REMAINING BALANCE
		# ------------------------------------------------

		remaining_amount = (
			flt(sales_invoice.grand_total)
			- flt(total_allocated_advance)
		)

		if remaining_amount < 0:

			remaining_amount = 0

		# ------------------------------------------------
		# UPDATE JOB
		# ------------------------------------------------

		self.sales_invoice_status = "Created"

		self.linked_invoice = sales_invoice.name

		self.save(ignore_permissions=True)

		# ------------------------------------------------
		# CREATE BALANCE PAYMENT ENTRY
		# ------------------------------------------------

		if (
			self.payment == "Payment Now"
			and remaining_amount > 0
		):

			payment_entry = frappe.new_doc(
				"Payment Entry"
			)

			payment_entry.payment_type = "Receive"

			payment_entry.company = sales_invoice.company

			payment_entry.posting_date = frappe.utils.nowdate()

			payment_entry.mode_of_payment = self.mode_of_payment

			payment_entry.party_type = "Customer"

			payment_entry.party = sales_invoice.customer

			payment_entry.custom_job = self.name

			payment_entry.job = self.name

			# ------------------------------------------------
			# MODE OF PAYMENT TYPE
			# ------------------------------------------------

			mop_type = frappe.db.get_value(
				"Mode of Payment",
				self.mode_of_payment,
				"type"
			)

			# ------------------------------------------------
			# REFERENCE DETAILS
			# ------------------------------------------------

			if mop_type == "Bank":

				if not reference_no:

					frappe.throw(
						"Reference No is required"
					)

				if not reference_date:

					frappe.throw(
						"Reference Date is required"
					)

				payment_entry.reference_no = reference_no

				payment_entry.reference_date = reference_date

			# ------------------------------------------------
			# ACCOUNT FETCH
			# ------------------------------------------------

			if mop_type == "Bank":

				default_bank_account = frappe.db.get_value(
					"Company",
					sales_invoice.company,
					"default_bank_account"
				)

				if not default_bank_account:

					frappe.throw(
						f"Default bank account is not set "
						f"for company: {sales_invoice.company}"
					)

				payment_entry.paid_to = default_bank_account

			else:

				payment_entry.paid_to = frappe.db.get_value(
					"Mode of Payment Account",
					{
						"parent": self.mode_of_payment,
						"company": sales_invoice.company
					},
					"default_account"
				)

				if not payment_entry.paid_to:

					frappe.throw(
						f"No account found for "
						f"Mode of Payment: "
						f"{self.mode_of_payment}"
					)

			# ------------------------------------------------
			# PAYMENT AMOUNT
			# ------------------------------------------------

			if payment_type == "Partially Paid":

				paid_amount = flt(
					partial_amount or 0
				)

				if paid_amount <= 0:

					frappe.throw(
						"Partial amount must be "
						"greater than 0"
					)

				if paid_amount > remaining_amount:

					frappe.throw(
						"Partial amount cannot exceed "
						"Remaining Amount"
					)

			else:

				paid_amount = remaining_amount

			# ------------------------------------------------
			# REFERENCE
			# ------------------------------------------------

			payment_entry.append("references", {

				"reference_doctype": "Sales Invoice",

				"reference_name": sales_invoice.name,

				"total_amount": sales_invoice.grand_total,

				"outstanding_amount": remaining_amount,

				"allocated_amount": paid_amount,

				"job": self.name
			})

			# ------------------------------------------------
			# AMOUNT
			# ------------------------------------------------

			payment_entry.paid_amount = paid_amount

			payment_entry.received_amount = paid_amount

			# ------------------------------------------------
			# SAVE
			# ------------------------------------------------

			payment_entry.insert(
				ignore_permissions=True
			)

			payment_entry.submit()

			# ------------------------------------------------
			# UPDATE JOB PAYMENT ENTRY
			# ------------------------------------------------

			self.sales_invoice_payment_entry = (
				payment_entry.name
			)

			self.save(ignore_permissions=True)

			return payment_entry.name

		return sales_invoice.name




# ///////////////////////////////////////////////////////////////
# /////////////////////////////////////////////////////////////////









	# @frappe.whitelist()
	# def create_pinvoice(self, tax_template=None):

	# 	# -------------------------
	# 	# Filter outsource rows
	# 	# -------------------------
	# 	outsource_rows = [row for row in self.tasks if row.employee__outsource == "Outsource"]

	# 	if not outsource_rows:
	# 		frappe.throw("No outsource rows found in tasks table.")

	# 	# -------------------------
	# 	# Group by Supplier
	# 	# -------------------------
	# 	supplier_map = {}
	# 	for row in outsource_rows:
	# 		if not row.outsource_supplier:
	# 			frappe.throw(f"Outsource Supplier missing for item {row.item_code}")

	# 		supplier_map.setdefault(row.outsource_supplier, []).append(row)

	# 	created_pis = []

	# 	# -------------------------
	# 	# Loop Suppliers
	# 	# -------------------------
	# 	for supplier, rows in supplier_map.items():

	# 		pi = frappe.new_doc("Purchase Invoice")
	# 		pi.supplier = supplier
	# 		pi.company = frappe.defaults.get_user_default("company")
	# 		pi.posting_date = frappe.utils.nowdate()
	# 		pi.custom_job = self.name
	# 		pi.job = self.name
	# 		pi.update_stock = 0
	# 		pi.disable_rounded_total = 1

	# 		if tax_template:
	# 			pi.taxes_and_charges = tax_template

	# 		# -------------------------
	# 		# Add Items
	# 		# -------------------------
	# 		for row in rows:

	# 			matching_item = next(
	# 				(i for i in self.items if i.item_code == row.item_code),
	# 				None
	# 			)

	# 			if not matching_item:
	# 				frappe.throw(f"No matching item found for {row.item_code}")

	# 			pi.append("items", {
	# 				"item_code": matching_item.item_code,
	# 				"qty": matching_item.job_qty or 1,
	# 				"rate": row.outsource_charge or 0
	# 			})

	# 		if tax_template:
	# 			pi.taxes_and_charges = tax_template
	# 			pi.set("taxes", [])              
	# 			pi.set_taxes()
			
	# 		pi.set_missing_values()
	# 		pi.run_method("calculate_taxes_and_totals")

	# 		pi.insert(ignore_permissions=True)
		
	# 		pi.submit()

	# 		created_pis.append(pi.name)

	# 		# -------------------------
	# 		# Payment Entry Creation
	# 		# -------------------------
	# 		if self.payment_pi == "Payment Now":

	# 			if not self.mode_of_payment_pi:
	# 				frappe.throw("Mode of Payment required for Payment Now")

	# 			# Mode of Payment Account
	# 			mop_account = frappe.db.get_value(
	# 				"Mode of Payment Account",
	# 				{
	# 					"parent": self.mode_of_payment_pi,
	# 					"company": pi.company
	# 				},
	# 				"default_account"
	# 			)

	# 			if not mop_account:
	# 				frappe.throw(
	# 					f"No account set in Mode of Payment {self.mode_of_payment_pi}"
	# 				)

	# 			paid_from = mop_account

	# 			# Account Currency
	# 			account_currency = frappe.db.get_value(
	# 				"Account",
	# 				paid_from,
	# 				"account_currency"
	# 			)

	# 			# Supplier Payable Account
	# 			paid_to = frappe.db.get_value(
	# 				"Party Account",
	# 				{
	# 					"parenttype": "Supplier",
	# 					"parent": supplier,
	# 					"company": pi.company
	# 				},
	# 				"account"
	# 			)

	# 			if not paid_to:
	# 				paid_to = frappe.get_value(
	# 					"Company",
	# 					pi.company,
	# 					"default_payable_account"
	# 				)

	# 			if not paid_to:
	# 				frappe.throw(
	# 					f"No Payable Account found for Supplier {supplier}"
	# 				)

	# 			# Create Payment Entry
	# 			pe = frappe.new_doc("Payment Entry")
	# 			pe.payment_type = "Pay"
	# 			pe.party_type = "Supplier"
	# 			pe.party = supplier
	# 			pe.company = pi.company
	# 			pe.posting_date = frappe.utils.nowdate()
	# 			pe.mode_of_payment = self.mode_of_payment_pi
	# 			pe.job = self.name

	# 			pe.paid_from = paid_from
	# 			pe.paid_from_account_currency = account_currency
	# 			pe.paid_to = paid_to



	# 			pe.paid_amount = pi.grand_total
	# 			pe.received_amount = pi.grand_total

	# 			pe.source_exchange_rate = 1
	# 			pe.target_exchange_rate = 1

	# 			pe.append("references", {
	# 				"reference_doctype": "Purchase Invoice",
	# 				"reference_name": pi.name,
	# 				"total_amount": pi.grand_total,
	# 				"allocated_amount": pi.grand_total
	# 			})

	# 			pe.insert(ignore_permissions=True)
	# 			pi.set_missing_values()
	# 			pi.calculate_taxes_and_totals()
	# 			pe.submit()


	# 		# -------------------------
	# 		# Update Child Rows
	# 		# -------------------------
	# 		for row in rows:
	# 			row.purchase_invoice = pi.name

	# 	# -------------------------
	# 	# Update Job
	# 	# -------------------------
	# 	self.purchase_invoice_status = "Created"
	# 	self.purchase_invoice = created_pis[-1]
	# 	self.save(ignore_permissions=True)

	# 	return created_pis



	@frappe.whitelist()
	def create_pinvoice(
		self,
		tax_template=None,
		reference_no=None,
		reference_date=None
	):

		# -------------------------
		# FILTER OUTSOURCE ROWS
		# -------------------------

		outsource_rows = [

			row for row in self.tasks

			if row.employee__outsource == "Outsource"
		]

		if not outsource_rows:

			frappe.throw(
				"No outsource rows found in tasks table."
			)

		# -------------------------
		# GROUP BY SUPPLIER
		# -------------------------

		supplier_map = {}

		for row in outsource_rows:

			if not row.outsource_supplier:

				frappe.throw(
					f"Outsource Supplier missing "
					f"for item {row.item_code}"
				)

			supplier_map.setdefault(
				row.outsource_supplier,
				[]
			).append(row)

		created_pis = []

		# -------------------------
		# LOOP SUPPLIERS
		# -------------------------

		for supplier, rows in supplier_map.items():

			pi = frappe.new_doc(
				"Purchase Invoice"
			)

			pi.supplier = supplier

			pi.company = frappe.defaults.get_user_default(
				"company"
			)

			pi.posting_date = frappe.utils.nowdate()

			pi.custom_job = self.name

			pi.job = self.name

			pi.update_stock = 0

			pi.disable_rounded_total = 1

			if tax_template:

				pi.taxes_and_charges = tax_template

			# -------------------------
			# ADD ITEMS
			# -------------------------

			for row in rows:

				matching_item = next(

					(
						i for i in self.items

						if i.item_code == row.item_code
					),

					None
				)

				if not matching_item:

					frappe.throw(
						f"No matching item found "
						f"for {row.item_code}"
					)

				pi.append("items", {

					"item_code":
						matching_item.item_code,

					"qty":
						matching_item.job_qty or 1,

					"rate":
						row.outsource_charge or 0
				})

			# -------------------------
			# TAX TEMPLATE
			# -------------------------

			if tax_template:

				pi.taxes_and_charges = tax_template

				pi.set("taxes", [])

				pi.set_taxes()

			# -------------------------
			# CALCULATE
			# -------------------------

			pi.set_missing_values()

			pi.run_method(
				"calculate_taxes_and_totals"
			)

			# -------------------------
			# SAVE PI
			# -------------------------

			pi.insert(ignore_permissions=True)

			pi.submit()

			created_pis.append(pi.name)

			# -------------------------
			# PAYMENT ENTRY CREATION
			# -------------------------

			if self.payment_pi == "Payment Now":

				if not self.mode_of_payment_pi:

					frappe.throw(
						"Mode of Payment required "
						"for Payment Now"
					)

				# -------------------------
				# MODE OF PAYMENT TYPE
				# -------------------------

				mop_type = frappe.db.get_value(
					"Mode of Payment",
					self.mode_of_payment_pi,
					"type"
				)

				# -------------------------
				# REFERENCE VALIDATION
				# -------------------------

				if mop_type == "Bank":

					if not reference_no:

						frappe.throw(
							"Reference No is required"
						)

					if not reference_date:

						frappe.throw(
							"Reference Date is required"
						)

				# -------------------------
				# FETCH ACCOUNT
				# -------------------------

				if mop_type == "Bank":

					mop_account = frappe.db.get_value(
						"Company",
						pi.company,
						"default_bank_account"
					)

				else:

					mop_account = frappe.db.get_value(
						"Mode of Payment Account",
						{
							"parent":
								self.mode_of_payment_pi,

							"company":
								pi.company
						},
						"default_account"
					)

				if not mop_account:

					frappe.throw(

						f"No account set in "
						f"Mode of Payment "
						f"{self.mode_of_payment_pi}"
					)

				paid_from = mop_account

				# -------------------------
				# ACCOUNT CURRENCY
				# -------------------------

				account_currency = frappe.db.get_value(
					"Account",
					paid_from,
					"account_currency"
				)

				# -------------------------
				# SUPPLIER PAYABLE ACCOUNT
				# -------------------------

				paid_to = frappe.db.get_value(
					"Party Account",
					{
						"parenttype": "Supplier",

						"parent": supplier,

						"company": pi.company
					},
					"account"
				)

				if not paid_to:

					paid_to = frappe.get_value(
						"Company",
						pi.company,
						"default_payable_account"
					)

				if not paid_to:

					frappe.throw(

						f"No Payable Account found "
						f"for Supplier {supplier}"
					)

				# -------------------------
				# CREATE PAYMENT ENTRY
				# -------------------------

				pe = frappe.new_doc(
					"Payment Entry"
				)

				pe.payment_type = "Pay"

				pe.party_type = "Supplier"

				pe.party = supplier

				pe.company = pi.company

				pe.posting_date = frappe.utils.nowdate()

				pe.mode_of_payment = (
					self.mode_of_payment_pi
				)

				pe.job = self.name

				# -------------------------
				# SET REFERENCE DETAILS
				# -------------------------

				if mop_type == "Bank":

					pe.reference_no = reference_no

					pe.reference_date = reference_date

				pe.paid_from = paid_from

				pe.paid_from_account_currency = (
					account_currency
				)

				pe.paid_to = paid_to

				# -------------------------
				# AMOUNTS
				# -------------------------

				pe.paid_amount = pi.grand_total

				pe.received_amount = pi.grand_total

				pe.source_exchange_rate = 1

				pe.target_exchange_rate = 1

				# -------------------------
				# REFERENCE
				# -------------------------

				pe.append("references", {

					"reference_doctype":
						"Purchase Invoice",

					"reference_name":
						pi.name,

					"total_amount":
						pi.grand_total,

					"allocated_amount":
						pi.grand_total
				})

				# -------------------------
				# SAVE PAYMENT ENTRY
				# -------------------------

				pe.insert(ignore_permissions=True)

				pe.submit()

			# -------------------------
			# UPDATE CHILD ROWS
			# -------------------------

			for row in rows:

				row.purchase_invoice = pi.name

		# -------------------------
		# UPDATE JOB
		# -------------------------

		self.purchase_invoice_status = "Created"

		self.purchase_invoice = created_pis[-1]

		self.save(ignore_permissions=True)

		return created_pis










 
	# @frappe.whitelist()
	# def create_expense(
	# 	self,
	# 	expense_type,
	# 	amount,
	# 	supplier,
	# 	item_code,
	# 	payment_type,
	# 	mode_of_payment=None,
	# 	taxes_template=None,
	# 	reference_doctype=None,
	# 	reference_name=None
	# ):

	# 	if not item_code:
	# 		frappe.throw("Item is mandatory to create Expense")

	# 	company = self.company or frappe.defaults.get_user_default("Company")

	# 	# -----------------------
	# 	# Create Purchase Invoice
	# 	# -----------------------
	# 	pi = frappe.new_doc("Purchase Invoice")

	# 	pi.supplier = supplier
	# 	pi.company = company
	# 	pi.posting_date = frappe.utils.nowdate()
	# 	pi.update_stock = 0
	# 	pi.job = self.name
	# 	pi.disable_rounded_total = 1
	# 	pi.custom_job = self.name

	# 	# ADD ITEM
	# 	pi.append("items", {
	# 		"item_code": item_code,
	# 		"qty": 1,
	# 		"rate": amount,
	# 		"expense_type": expense_type
	# 	})

	# 	# -----------------------
	# 	# SET TAX TEMPLATE
	# 	# -----------------------
	# 	if taxes_template:
	# 		pi.taxes_and_charges = taxes_template

	# 	# IMPORTANT → run before taxes
	# 	pi.set_missing_values()

	# 	# LOAD TAX ROWS
	# 	if taxes_template:
	# 		pi.set_taxes()

	# 	# CALCULATE
	# 	pi.calculate_taxes_and_totals()

	# 	# SAVE
	# 	pi.insert(ignore_permissions=True)
	# 	pi.submit()

	# 	# -----------------------
	# 	# PAYMENT ENTRY
	# 	# -----------------------
	# 	if payment_type == "Payment Now":

	# 		if not mode_of_payment:
	# 			frappe.throw("Mode of Payment required for Payment Now")

	# 		# Mode of Payment Account
	# 		paid_account = frappe.db.get_value(
	# 			"Mode of Payment Account",
	# 			{
	# 				"parent": mode_of_payment,
	# 				"company": company
	# 			},
	# 			"default_account"
	# 		)

	# 		if not paid_account:
	# 			frappe.throw(
	# 				f"Default account not set for Mode of Payment {mode_of_payment}"
	# 			)

	# 		# -----------------------
	# 		# FETCH PI AMOUNTS (Tax Included)
	# 		# -----------------------
	# 		grand_total = frappe.db.get_value(
	# 			"Purchase Invoice",
	# 			pi.name,
	# 			"grand_total"
	# 		)

	# 		outstanding_amount = frappe.db.get_value(
	# 			"Purchase Invoice",
	# 			pi.name,
	# 			"outstanding_amount"
	# 		)

	# 		# -----------------------
	# 		# SUPPLIER PAYABLE ACCOUNT
	# 		# -----------------------
	# 		payable_account = frappe.db.get_value(
	# 			"Party Account",
	# 			{
	# 				"parenttype": "Supplier",
	# 				"parent": supplier,
	# 				"company": company
	# 			},
	# 			"account"
	# 		)

	# 		if not payable_account:
	# 			payable_account = frappe.get_value(
	# 				"Company",
	# 				company,
	# 				"default_payable_account"
	# 			)

	# 		if not payable_account:
	# 			frappe.throw(f"No Payable Account found for Supplier {supplier}")

	# 		# Account Currency
	# 		account_currency = frappe.db.get_value(
	# 			"Account",
	# 			payable_account,
	# 			"account_currency"
	# 		)

	# 		# -----------------------
	# 		# CREATE PAYMENT ENTRY
	# 		# -----------------------
	# 		pe = frappe.new_doc("Payment Entry")
	# 		pe.payment_type = "Pay"
	# 		pe.party_type = "Supplier"
	# 		pe.party = supplier
	# 		pe.company = company
	# 		pe.posting_date = frappe.utils.nowdate()
	# 		pe.mode_of_payment = mode_of_payment
	# 		pe.job = self.name

	# 		pe.paid_from = paid_account
	# 		pe.paid_to = payable_account

	# 		pe.party_account = payable_account
	# 		pe.party_account_currency = account_currency

	# 		# TAX INCLUDED PAYMENT
	# 		pe.paid_amount = grand_total
	# 		pe.received_amount = grand_total

	# 		pe.append("references", {
	# 			"reference_doctype": "Purchase Invoice",
	# 			"reference_name": pi.name,
	# 			"total_amount": grand_total,
	# 			"outstanding_amount": outstanding_amount,
	# 			"allocated_amount": grand_total
	# 		})

	# 		# ONLY THIS — NO TAX METHOD
	# 		pe.set_missing_values()

	# 		pe.insert(ignore_permissions=True)
	# 		pe.submit()


	@frappe.whitelist()
	def create_expense(
		self,
		expense_type,
		amount,
		supplier,
		item_code,
		payment_type,
		mode_of_payment=None,
		reference_no=None,
		reference_date=None,
		taxes_template=None,
		reference_doctype=None,
		reference_name=None
	):

		if not item_code:

			frappe.throw(
				"Item is mandatory to create Expense"
			)

		company = (
			self.company
			or frappe.defaults.get_user_default("Company")
		)

		# -----------------------
		# CREATE PURCHASE INVOICE
		# -----------------------

		pi = frappe.new_doc("Purchase Invoice")

		pi.supplier = supplier

		pi.company = company

		pi.posting_date = frappe.utils.nowdate()

		pi.update_stock = 0

		pi.job = self.name

		pi.disable_rounded_total = 1

		pi.custom_job = self.name

		# -----------------------
		# ADD ITEM
		# -----------------------

		pi.append("items", {

			"item_code": item_code,

			"qty": 1,

			"rate": amount,

			"expense_type": expense_type
		})

		# -----------------------
		# SET TAX TEMPLATE
		# -----------------------

		if taxes_template:

			pi.taxes_and_charges = taxes_template

		# IMPORTANT → run before taxes

		pi.set_missing_values()

		# LOAD TAX ROWS

		if taxes_template:

			pi.set_taxes()

		# CALCULATE

		pi.calculate_taxes_and_totals()

		# SAVE

		pi.insert(ignore_permissions=True)

		pi.submit()

		# -----------------------
		# PAYMENT ENTRY
		# -----------------------

		if payment_type == "Payment Now":

			if not mode_of_payment:

				frappe.throw(
					"Mode of Payment required for Payment Now"
				)

			# -----------------------
			# MODE OF PAYMENT TYPE
			# -----------------------

			mop_type = frappe.db.get_value(
				"Mode of Payment",
				mode_of_payment,
				"type"
			)

			# -----------------------
			# REFERENCE DETAILS
			# -----------------------

			if mop_type == "Bank":

				if not reference_no:

					frappe.throw(
						"Reference No is required"
					)

				if not reference_date:

					frappe.throw(
						"Reference Date is required"
					)

			# -----------------------
			# FETCH PAID ACCOUNT
			# -----------------------

			if mop_type == "Bank":

				paid_account = frappe.db.get_value(
					"Company",
					company,
					"default_bank_account"
				)

			else:

				paid_account = frappe.db.get_value(
					"Mode of Payment Account",
					{
						"parent": mode_of_payment,
						"company": company
					},
					"default_account"
				)

			if not paid_account:

				frappe.throw(
					f"Default account not set for "
					f"Mode of Payment {mode_of_payment}"
				)

			# -----------------------
			# FETCH PI AMOUNTS
			# -----------------------

			grand_total = frappe.db.get_value(
				"Purchase Invoice",
				pi.name,
				"grand_total"
			)

			outstanding_amount = frappe.db.get_value(
				"Purchase Invoice",
				pi.name,
				"outstanding_amount"
			)

			# -----------------------
			# SUPPLIER PAYABLE ACCOUNT
			# -----------------------

			payable_account = frappe.db.get_value(
				"Party Account",
				{
					"parenttype": "Supplier",
					"parent": supplier,
					"company": company
				},
				"account"
			)

			if not payable_account:

				payable_account = frappe.get_value(
					"Company",
					company,
					"default_payable_account"
				)

			if not payable_account:

				frappe.throw(
					f"No Payable Account found "
					f"for Supplier {supplier}"
				)

			# -----------------------
			# ACCOUNT CURRENCY
			# -----------------------

			account_currency = frappe.db.get_value(
				"Account",
				payable_account,
				"account_currency"
			)

			# -----------------------
			# CREATE PAYMENT ENTRY
			# -----------------------

			pe = frappe.new_doc("Payment Entry")

			pe.payment_type = "Pay"

			pe.party_type = "Supplier"

			pe.party = supplier

			pe.company = company

			pe.posting_date = frappe.utils.nowdate()

			pe.mode_of_payment = mode_of_payment

			pe.job = self.name

			# -----------------------
			# SET REFERENCE DETAILS
			# -----------------------

			if mop_type == "Bank":

				pe.reference_no = reference_no

				pe.reference_date = reference_date

			pe.paid_from = paid_account

			pe.paid_to = payable_account

			pe.party_account = payable_account

			pe.party_account_currency = account_currency

			# -----------------------
			# TAX INCLUDED PAYMENT
			# -----------------------

			pe.paid_amount = grand_total

			pe.received_amount = grand_total

			# -----------------------
			# REFERENCE
			# -----------------------

			pe.append("references", {

				"reference_doctype": "Purchase Invoice",

				"reference_name": pi.name,

				"total_amount": grand_total,

				"outstanding_amount": outstanding_amount,

				"allocated_amount": grand_total
			})

			# -----------------------
			# SET MISSING VALUES
			# -----------------------

			pe.set_missing_values()

			# -----------------------
			# SAVE
			# -----------------------

			pe.insert(ignore_permissions=True)

			pe.submit()

			return pe.name

		return pi.name



# /////////////////////////////////////////////////////////////////
# ////////////////////////////////////////////////////////////


	@frappe.whitelist()
	def create_advance_receipt(
		self,
		amount,
		mode_of_payment,
		reference_no=None,
		reference_date=None
	):

		if not amount:
			frappe.throw("Amount is required")

		customer = self.customer

		pe = frappe.new_doc("Payment Entry")

		pe.payment_type = "Receive"

		pe.party_type = "Customer"

		pe.party = customer

		pe.company = self.company

		pe.posting_date = frappe.utils.nowdate()

		pe.mode_of_payment = mode_of_payment

		pe.custom_job = self.name

		pe.job = self.name

		# ------------------------------------------------
		# MODE OF PAYMENT TYPE
		# ------------------------------------------------

		mop_type = frappe.db.get_value(
			"Mode of Payment",
			mode_of_payment,
			"type"
		)

		# ------------------------------------------------
		# REFERENCE DETAILS
		# ------------------------------------------------

		if mop_type == "Bank":

			if not reference_no:
				frappe.throw("Reference No is required")

			if not reference_date:
				frappe.throw("Reference Date is required")

			pe.reference_no = reference_no

			pe.reference_date = reference_date

		# ------------------------------------------------
		# Account Fetch
		# ------------------------------------------------

		if mop_type == "Bank":

			pe.paid_to = frappe.db.get_value(
				"Company",
				self.company,
				"default_bank_account"
			)

		else:

			pe.paid_to = frappe.db.get_value(
				"Mode of Payment Account",
				{
					"parent": mode_of_payment,
					"company": self.company
				},
				"default_account"
			)

		if not pe.paid_to:

			frappe.throw(
				f"No account found for Mode of Payment: {mode_of_payment}"
			)

		# ------------------------------------------------
		# Amount
		# ------------------------------------------------

		pe.paid_amount = amount

		pe.received_amount = amount

		pe.unallocated_amount = amount

		pe.insert(ignore_permissions=True)

		pe.submit()

		return pe.name





	@frappe.whitelist()
	def create_outsource_advance_payment(
		self,
		suppliers,
		mode_of_payment,
		reference_no=None,
		reference_date=None
	):

		import json

		# ----------------------------------------
		# PARSE JSON
		# ----------------------------------------

		if isinstance(suppliers, str):
			suppliers = json.loads(suppliers)

		if not suppliers:
			frappe.throw("No supplier rows found")

		created_entries = []

		# ----------------------------------------
		# LOOP ROWS
		# ----------------------------------------

		for row in suppliers:

			supplier = row.get("supplier")

			amount = flt(row.get("advance_amount"))

			if not supplier:
				continue

			if amount <= 0:
				continue

			# ----------------------------------------
			# CREATE PAYMENT ENTRY
			# ----------------------------------------

			pe = frappe.new_doc("Payment Entry")

			pe.payment_type = "Pay"

			pe.party_type = "Supplier"

			pe.party = supplier

			pe.company = self.company

			pe.posting_date = frappe.utils.nowdate()

			pe.mode_of_payment = mode_of_payment

			pe.custom_job = self.name

			pe.job = self.name

			# ----------------------------------------
			# MODE OF PAYMENT TYPE
			# ----------------------------------------

			mop_type = frappe.db.get_value(
				"Mode of Payment",
				mode_of_payment,
				"type"
			)

			# ----------------------------------------
			# REFERENCE DETAILS
			# ----------------------------------------

			if mop_type == "Bank":

				if not reference_no:
					frappe.throw("Reference No is required")

				if not reference_date:
					frappe.throw("Reference Date is required")

				pe.reference_no = reference_no

				pe.reference_date = reference_date

			# ----------------------------------------
			# FETCH MODE OF PAYMENT ACCOUNT
			# ----------------------------------------

			paid_from = frappe.db.get_value(
				"Mode of Payment Account",
				{
					"parent": mode_of_payment,
					"company": self.company
				},
				"default_account"
			)

			if not paid_from:

				frappe.throw(
					f"No default account found for "
					f"Mode of Payment {mode_of_payment}"
				)

			pe.paid_from = paid_from

			# ----------------------------------------
			# SUPPLIER PAYABLE ACCOUNT
			# ----------------------------------------

			paid_to = frappe.db.get_value(
				"Party Account",
				{
					"parenttype": "Supplier",
					"parent": supplier,
					"company": self.company
				},
				"account"
			)

			if not paid_to:

				paid_to = frappe.get_value(
					"Company",
					self.company,
					"default_payable_account"
				)

			if not paid_to:

				frappe.throw(
					f"No payable account found "
					f"for supplier {supplier}"
				)

			pe.paid_to = paid_to

			# ----------------------------------------
			# ACCOUNT CURRENCY
			# ----------------------------------------

			account_currency = frappe.db.get_value(
				"Account",
				paid_from,
				"account_currency"
			)

			pe.paid_from_account_currency = account_currency

			# ----------------------------------------
			# AMOUNT
			# ----------------------------------------

			pe.paid_amount = amount

			pe.received_amount = amount

			pe.unallocated_amount = amount

			# ----------------------------------------
			# SAVE
			# ----------------------------------------

			pe.insert(ignore_permissions=True)

			pe.submit()

			created_entries.append(pe.name)

		# ----------------------------------------
		# RETURN
		# ----------------------------------------

		return created_entries


	
















