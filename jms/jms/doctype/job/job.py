# Copyright (c) 2025, Your Company and contributors
# For license information, please see license.txt

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import add_days, date_diff, getdate, today, nowdate


class Job(Document):
	def validate(self):
		self.set_year()
		self.validate_customer_or_agent()
		self.create_customer_from_agent_if_required()
		self.validate_staff_assignment()
		self.calculate_amounts()
		self.calculate_agent_commission()
		self.set_expected_completion_date()
		self.check_overdue()
		self.auto_create_tasks_from_items()

	def after_insert(self):
		pass  # Tasks are now created from work templates in items

	def set_year(self):
		"""Set year from date field"""
		if self.date:
			self.year = getdate(self.date).year

	def validate_customer_or_agent(self):
		"""Ensure either customer or agent (with create flag) is provided"""
		if not self.customer and not (self.create_customer_from_agent and self.agent):
			frappe.throw(_("Please select either a Customer or tick 'Create Customer from Agent' and select an Agent"))

	def create_customer_from_agent_if_required(self):
		"""Create customer from agent if the checkbox is ticked"""
		if self.create_customer_from_agent and self.agent and not self.customer:
			agent = frappe.get_doc("Agent", self.agent)

			# Check if customer already exists for this agent
			if agent.linked_customer:
				self.customer = agent.linked_customer
			else:
				# Create new customer
				customer = frappe.get_doc({
					"doctype": "Customer",
					"customer_name": agent.agent_name,
					"customer_type": "Individual",
					"mobile_no": agent.mobile,
					"email_id": agent.email
				})
				customer.insert(ignore_permissions=True)

				# Link customer back to agent
				frappe.db.set_value("Agent", agent.name, "linked_customer", customer.name)

				self.customer = customer.name
				frappe.msgprint(_("Customer {0} created from Agent {1}").format(customer.name, agent.agent_name))

	def validate_staff_assignment(self):
		"""Validate that only one staff is marked as primary"""
		if not self.staff_assignment:
			return

		primary_count = sum(1 for staff in self.staff_assignment if staff.is_primary)

		if primary_count > 1:
			frappe.throw(_("Only one staff member can be marked as Primary"))

	def calculate_amounts(self):
		"""Calculate gross amount, net amount, and balance"""
		# Calculate gross amount from items
		gross_total = 0
		for item in self.items:
			# Calculate item total
			item_total = (item.fee_price or 0) * (item.job_qty or 1)
			item_total += (item.extra or 0) + (item.surcharge or 0)

			# Apply VAT to item
			if item.vat:
				vat_amount = item_total * (item.vat / 100)
				item_total += vat_amount

			item.cost = item_total
			item.total = item_total
			gross_total += item_total

		self.gross_amount = gross_total

		# Apply discount
		discounted_amount = self.gross_amount - (self.discount or 0)

		# Apply VAT at job level (if any)
		if self.vat:
			vat_amount = discounted_amount * (self.vat / 100)
			self.net_amount = discounted_amount + vat_amount
		else:
			self.net_amount = discounted_amount

		# Calculate balance
		self.balance = self.net_amount - (self.paid_up or 0)

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

	def auto_create_tasks_from_items(self):
		"""Auto-create tasks from work template sub tasks"""
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

			# Check if it has sub tasks
			if work_template.has_sub_tasks and work_template.sub_tasks:
				for sub_task in work_template.sub_tasks:
					# Check if task already exists
					existing_task = False
					for existing in self.tasks:
						if existing.task_name == f"{work_template.description} - {sub_task.task_name}":
							existing_task = True
							break

					if not existing_task:
						due_date = add_days(self.start_date, sub_task.due_days or 0)

						self.append("tasks", {
							"task_name": f"{work_template.description} - {sub_task.task_name}",
							"assigned_to": sub_task.assigned_to,
							"due_date": due_date,
							"status": sub_task.status or "Pending"
						})

	def get_progress(self):
		"""Calculate job progress based on completed tasks"""
		if not self.tasks:
			return 0

		total_tasks = len(self.tasks)
		completed_tasks = len([task for task in self.tasks if task.status == "Completed"])

		return round((completed_tasks / total_tasks) * 100, 2) if total_tasks else 0

	def on_update(self):
		"""Update status based on tasks completion and payment"""
		if self.tasks:
			progress = self.get_progress()

			# Auto-update status based on progress and payment
			if progress == 100 and self.balance == 0:
				self.db_set("status", "COMPLETED")
			elif progress == 100 and self.balance > 0:
				self.db_set("status", "AMT_PENDING(COMPLETED)")
			elif progress > 0 and self.status == "CREATED":
				self.db_set("status", "PROCESSING")

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
def make_sales_invoice(source_name, target_doc=None):
	"""Create Sales Invoice from Job"""
	from frappe.model.mapper import get_mapped_doc

	def set_missing_values(source, target):
		target.customer = source.customer
		target.run_method("set_missing_values")
		target.run_method("calculate_taxes_and_totals")

	def update_item(source_doc, target_doc, source_parent):
		target_doc.qty = source_doc.job_qty or 1
		target_doc.rate = source_doc.fee_price or 0

	doclist = get_mapped_doc("Job", source_name, {
		"Job": {
			"doctype": "Sales Invoice",
			"field_map": {
				"customer": "customer",
				"net_amount": "total"
			}
		},
		"Job Item": {
			"doctype": "Sales Invoice Item",
			"field_map": {
				"description": "description",
				"fee_price": "rate"
			},
			"postprocess": update_item
		}
	}, target_doc, set_missing_values)

	return doclist
