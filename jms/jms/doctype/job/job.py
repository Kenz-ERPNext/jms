# Copyright (c) 2025, Your Company and contributors
# For license information, please see license.txt
 
import frappe
from frappe import _
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



	@frappe.whitelist()
	def create_invoice(self, tax_template=None):

		sales_invoice = frappe.new_doc("Sales Invoice")

		if self.receivable_from == "Customer":
			sales_invoice.customer = self.customer
		else:
			sales_invoice.customer = self.agent_customer

		sales_invoice.company = frappe.defaults.get_user_default("company")
		sales_invoice.posting_date = frappe.utils.nowdate()
		sales_invoice.due_date = frappe.utils.add_days(frappe.utils.nowdate(), 30)
		sales_invoice.custom_job = self.name

		if tax_template:
			sales_invoice.taxes_and_charges = tax_template

			sales_invoice.set_taxes()    

		if self.items:
			for row in self.items:
				sales_invoice.append("items", {
					"item_code": row.item_code,
					"description": row.description,
					"qty": row.job_qty,
					"rate": row.total_without_tax,
				})

		sales_invoice.run_method("calculate_taxes_and_totals")

		sales_invoice.insert(ignore_permissions=True)

		self.sales_invoice_status = "Created"
		self.linked_invoice = sales_invoice.name   
		self.save(ignore_permissions=True)

		return sales_invoice.name



	# @frappe.whitelist()
	# def create_pinvoice(self, tax_template=None):
	# 	outsource_rows = [row for row in self.tasks if row.employee__outsource == "Outsource"]

	# 	if not outsource_rows:
	# 		frappe.throw("No outsource rows found in tasks table.")

	# 	suppliers = list({row.outsource_supplier for row in outsource_rows})

	# 	if len(suppliers) > 1:
	# 		frappe.throw("Multiple outsource suppliers found. Please create invoice individually per supplier.")

	# 	supplier = suppliers[0]

	# 	if not supplier:
	# 		frappe.throw("Outsource Supplier is missing in some rows.")

	# 	pi = frappe.new_doc("Purchase Invoice")
	# 	pi.supplier = supplier
	# 	pi.company = frappe.defaults.get_user_default("company")
	# 	pi.posting_date = frappe.utils.nowdate()

	# 	if tax_template:
	# 		pi.taxes_and_charges = tax_template

	# 	for row in outsource_rows:
	# 		matching_item = next((i for i in self.items if i.item_code == row.item_code), None)

	# 		if not matching_item:
	# 			frappe.throw(f"No matching item found in Items table for item_code: {row.item_code}")

	# 		pi.append("items", {
	# 			"item_code": matching_item.item_code,
	# 			"qty": matching_item.job_qty or 1,
	# 			"rate": matching_item.total_without_tax or 0
	# 		})


	# 	pi.insert(ignore_permissions=True)

	# 	return pi.name

	@frappe.whitelist()
	def create_pinvoice(self, tax_template=None):
		outsource_rows = [row for row in self.tasks if row.employee__outsource == "Outsource"]

		if not outsource_rows:
			frappe.throw("No outsource rows found in tasks table.")

		suppliers = list({row.outsource_supplier for row in outsource_rows})

		if len(suppliers) > 1:
			frappe.throw("Multiple outsource suppliers found. Please create invoice individually per supplier.")

		supplier = suppliers[0]

		if not supplier:
			frappe.throw("Outsource Supplier is missing in some rows.")

		# Create Purchase Invoice
		pi = frappe.new_doc("Purchase Invoice")
		pi.supplier = supplier
		pi.company = frappe.defaults.get_user_default("company")
		pi.posting_date = frappe.utils.nowdate()

		if tax_template:
			pi.taxes_and_charges = tax_template

		for row in outsource_rows:
			matching_item = next((i for i in self.items if i.item_code == row.item_code), None)
			if not matching_item:
				frappe.throw(f"No matching item found in Items table for item_code: {row.item_code}")

			pi.append("items", {
				"item_code": matching_item.item_code,
				"qty": matching_item.job_qty or 1,
				"rate": matching_item.total_without_tax or 0
			})

		# Insert first so taxes can be computed
		pi.insert(ignore_permissions=True)

		# Now calculate taxes and totals properly
		pi.set_missing_values()
		pi.calculate_taxes_and_totals()
		pi.save()  # Save after calculation

		# Optional: submit immediately
		# pi.submit()

		return pi.name
















