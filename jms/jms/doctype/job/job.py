# Copyright (c) 2025, Your Company and contributors
# For license information, please see license.txt
 
import frappe
from frappe import _
from frappe.utils import flt
from frappe.model.document import Document
from frappe.utils import add_days, date_diff, getdate, today, nowdate

from jms.compat import patch_round_floats_in


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
		self.validate_closing()



 



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


	def validate_closing(self):
		"""Strict 'Closed' rule: a Job may be Closed only when every task
		(internal AND outsourced) is Completed and the full job amount has been
		received. On Close, stamp closing_date (profit is recognized in this
		month by the management profit reports). Re-opening clears it."""
		if self.status != "Closed":
			# leaving Closed state — clear the recognition date
			if self.closing_date:
				self.closing_date = None
			return

		# 1) all tasks completed (outsourced tasks are rows here too)
		pending = [t for t in (self.tasks or []) if (t.status or "") != "Completed"]
		if pending:
			frappe.throw(
				_("Cannot close this Job: {0} task(s) are not yet Completed. "
				  "All tasks (including outsourced) must be Completed first.").format(len(pending))
			)

		# 2) full job amount received (cash received >= billable net amount)
		received = flt(frappe.db.sql(
			"""SELECT COALESCE(SUM(paid_amount), 0)
				FROM `tabPayment Entry`
				WHERE job = %s AND docstatus = 1 AND payment_type = 'Receive'""",
			self.name,
		)[0][0])
		billable = flt(self.net_amount)
		if billable - received > 0.5:  # small tolerance for rounding
			frappe.throw(
				_("Cannot close this Job: full amount not yet received "
				  "(received {0} of {1}). Collect the balance before closing.").format(
					frappe.utils.fmt_money(received), frappe.utils.fmt_money(billable)
				)
			)

		# satisfied → stamp the recognition date
		if not self.closing_date:
			self.closing_date = frappe.utils.nowdate()


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
		active_templates = [item.work_template for item in (self.items or []) if item.work_template]

		# Clean up tasks whose work_template is no longer in items
		if self.tasks:
			self.tasks = [
				t for t in self.tasks
				if not getattr(t, "work_template", None) or t.work_template in active_templates
			]

		if not self.items:
			return

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
							"due_date": due_date,
							"status": sub_task.status or "Pending",
							"linked_task": sub_task.linked_task,
							"item_code": item.item_code,
							"work_template": item.work_template
						})

			# 2️⃣ If no sub_tasks but single task field exists
			elif getattr(work_template, "task", None):
				task_name = f"{work_template.description} - {work_template.task}"
				# Check if already exists
				if not any(existing.task_name == task_name for existing in self.tasks):
					due_date = self.start_date  # Or calculate differently if needed
					self.append("tasks", {
						"task_name": task_name,
						"due_date": due_date,
						"status": getattr(work_template, "status", "Pending"),
						"linked_task": getattr(work_template, "linked_task", None),
						"item_code": item.item_code,
						"work_template": item.work_template
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

	def _resolve_company(self):
		"""Company for documents created from this Job. Prefer the Job's own
		company so creation does not depend on the logged-in user having a
		default company set (a common cause of failures for non-admin users)."""
		return (
			self.company
			or frappe.defaults.get_user_default("company")
			or frappe.db.get_single_value("Global Defaults", "default_company")
		)

	def _apply_job_advances(self, doc):
		"""Auto-reconcile this Job's unallocated advance Payment Entries against
		the given (draft) Sales/Purchase Invoice. Only advances tagged to THIS
		job are applied, up to the invoice total. Call AFTER
		calculate_taxes_and_totals and BEFORE insert/submit. Returns the amount
		applied."""
		party = doc.supplier if doc.doctype == "Purchase Invoice" else doc.customer
		if not party:
			return 0.0

		doc.set("advances", [])
		try:
			doc.set_advances()
		except Exception:
			# never block invoice creation if advance lookup fails
			frappe.clear_last_message()
			return 0.0

		# keep only advances whose Payment Entry is tagged to this job
		pe_job_field = "job" if frappe.db.has_column("Payment Entry", "job") else "custom_job"
		job_rows = []
		for adv in (doc.get("advances") or []):
			if adv.reference_type == "Payment Entry" and frappe.db.get_value(
				"Payment Entry", adv.reference_name, pe_job_field
			) == self.name:
				job_rows.append(adv)
		doc.set("advances", job_rows)
		if not job_rows:
			return 0.0

		remaining = flt(doc.grand_total)
		applied = 0.0
		for adv in job_rows:
			alloc = min(flt(adv.advance_amount), remaining)
			adv.allocated_amount = alloc
			applied += alloc
			remaining -= alloc
		return applied

	@frappe.whitelist()
	def create_invoice(
		self,
		tax_template=None,
		payment_type=None,
		partial_amount=None,
		reference_no=None,
		reference_date=None,
		posting_date=None,
		payment=None,
		mode_of_payment=None
	):

		patch_round_floats_in()

		# Payment intent + mode are now collected in the creation dialog; fall
		# back to the values stored on the Job for backward compatibility.
		payment = payment or self.payment
		mode_of_payment = mode_of_payment or self.mode_of_payment

		# ------------------------------------------------
		# CREATE SALES INVOICE
		# ------------------------------------------------

		sales_invoice = frappe.new_doc("Sales Invoice")

		if self.receivable_from == "Customer":

			sales_invoice.customer = self.customer

		else:

			sales_invoice.customer = self.agent_customer

		if not sales_invoice.customer:

			frappe.throw(
				"Cannot create Sales Invoice: no Customer is set on this Job. "
				"Receivable From is '{0}' but the {1} is empty.".format(
					self.receivable_from or "(blank)",
					"Agent's linked Customer"
					if self.receivable_from == "Agent"
					else "Customer",
				)
			)

		sales_invoice.company = self._resolve_company()

		sales_invoice.set_posting_time = 1

		sales_invoice.posting_date = posting_date or frappe.utils.nowdate()

		sales_invoice.due_date = frappe.utils.add_days(
			sales_invoice.posting_date,
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
		# AUTO-RECONCILE THIS JOB'S CUSTOMER ADVANCES
		# (only advances tagged to this job — not the
		#  customer's advances from other jobs)
		# ------------------------------------------------

		total_allocated_advance = self._apply_job_advances(sales_invoice)

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
			payment == "Payment Now"
			and remaining_amount > 0
		):

			payment_entry = frappe.new_doc(
				"Payment Entry"
			)

			payment_entry.payment_type = "Receive"

			payment_entry.company = sales_invoice.company

			payment_entry.set_posting_time = 1

			payment_entry.posting_date = sales_invoice.posting_date

			payment_entry.mode_of_payment = mode_of_payment

			payment_entry.party_type = "Customer"

			payment_entry.party = sales_invoice.customer

			payment_entry.custom_job = self.name

			payment_entry.job = self.name

			# ------------------------------------------------
			# ACCOUNT FETCH
			# ------------------------------------------------

			# Always use the SELECTED Mode of Payment's account (for this
			# company), for Bank modes too — picking "RIYAD BANK" must post to
			# its account, not the company's default bank account.
			payment_entry.paid_to = frappe.db.get_value(
				"Mode of Payment Account",
				{
					"parent": mode_of_payment,
					"company": sales_invoice.company
				},
				"default_account"
			)

			if not payment_entry.paid_to:

				frappe.throw(
					f"No account found for "
					f"Mode of Payment: "
					f"{mode_of_payment}"
				)

			# ------------------------------------------------
			# REFERENCE DETAILS
			# ------------------------------------------------

			# Reference No/Date are not a feature the client wants to be asked
			# for at all — always fill them with safe defaults so ERPNext's
			# Bank-transaction validation never blocks submission, regardless
			# of whether the Mode of Payment/account happens to be Bank-typed.
			payment_entry.reference_no = reference_no or self.name
			payment_entry.reference_date = reference_date or sales_invoice.posting_date

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
		reference_date=None,
		posting_date=None,
		payment_pi=None,
		mode_of_payment_pi=None,
		supplier=None
	):

		patch_round_floats_in()

		# Payment intent + mode now come from the creation dialog; fall back to
		# the values stored on the Job for backward compatibility.
		payment_pi = payment_pi or self.payment_pi
		mode_of_payment_pi = mode_of_payment_pi or self.mode_of_payment_pi

		# -------------------------
		# FILTER OUTSOURCE ROWS
		# -------------------------

		outsource_rows = [

			row for row in self.tasks

			if row.employee__outsource == "Outsource"
			and not row.purchase_invoice
			and (not supplier or row.outsource_supplier == supplier)
		]

		if not outsource_rows:

			frappe.throw(
				"No unbilled outsource tasks found." if not supplier else f"No unbilled outsource tasks found for supplier {supplier}."
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

			pi.company = self._resolve_company()

			pi.set_posting_time = 1

			pi.posting_date = posting_date or frappe.utils.nowdate()

			pi.custom_job = self.name

			pi.job = self.name

			pi.update_stock = 0

			pi.disable_rounded_total = 1

			# Route outsourcing cost to its dedicated expense account so it
			# splits cleanly from general expenses in the profit reports.
			outsourcing_account = get_outsourcing_cost_account(pi.company)

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

				item_row = {

					"item_code":
						matching_item.item_code,

					"qty":
						matching_item.job_qty or 1,

					"rate":
						row.outsource_charge or 0
				}

				if outsourcing_account:
					item_row["expense_account"] = outsourcing_account

				pi.append("items", item_row)

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
			# AUTO-RECONCILE THIS JOB'S
			# SUPPLIER ADVANCES
			# -------------------------

			self._apply_job_advances(pi)

			# -------------------------
			# SAVE PI
			# -------------------------

			pi.insert(ignore_permissions=True)

			pi.submit()

			pi.reload()

			created_pis.append(pi.name)

			# -------------------------
			# PAYMENT ENTRY CREATION
			# -------------------------

			if payment_pi == "Payment Now" and flt(pi.outstanding_amount) > 0:

				if not mode_of_payment_pi:

					frappe.throw(
						"Mode of Payment required "
						"for Payment Now"
					)

				# -------------------------
				# FETCH ACCOUNT
				# -------------------------

				# Always use the selected Mode of Payment's account (Bank too),
				# not the company default bank account.
				mop_account = frappe.db.get_value(
					"Mode of Payment Account",
					{
						"parent":
							mode_of_payment_pi,

						"company":
							pi.company
					},
					"default_account"
				)

				if not mop_account:

					frappe.throw(

						f"No account set in "
						f"Mode of Payment "
						f"{mode_of_payment_pi}"
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

				pe.set_posting_time = 1

				pe.posting_date = pi.posting_date

				pe.mode_of_payment = (
					mode_of_payment_pi
				)

				pe.job = self.name

				# -------------------------
				# SET REFERENCE DETAILS
				# -------------------------

				# Reference No/Date are not a feature the client wants to be
				# asked for at all — always fill them with safe defaults so
				# ERPNext's Bank-transaction validation never blocks
				# submission, regardless of the Mode of Payment/account type.
				pe.reference_no = reference_no or self.name
				pe.reference_date = reference_date or pi.posting_date

				pe.paid_from = paid_from

				pe.paid_from_account_currency = (
					account_currency
				)

				pe.paid_to = paid_to

				# -------------------------
				# AMOUNTS
				# -------------------------

				pe.paid_amount = flt(pi.outstanding_amount)

				pe.received_amount = flt(pi.outstanding_amount)

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

					"outstanding_amount":
						flt(pi.outstanding_amount),

					"allocated_amount":
						flt(pi.outstanding_amount)
				})

				# -------------------------
				# SAVE PAYMENT ENTRY
				# -------------------------

				# TEMP DIAGNOSTIC — remove once the "Reference No and Reference
				# Date is mandatory" reports are confirmed resolved. Lets us
				# check Desk > Error Log to see exactly what this deployed
				# code actually set right before insert, without needing
				# server/terminal access.
				frappe.log_error(
					title="create_pinvoice: PE ref fields before insert",
					message=(
						f"job={self.name} mode_of_payment={mode_of_payment_pi} "
						f"paid_from={paid_from} reference_no={pe.reference_no} "
						f"reference_date={pe.reference_date}"
					),
				)

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
		reference_name=None,
		posting_date=None
	):

		patch_round_floats_in()

		if not item_code:

			frappe.throw(
				"Item is mandatory to create Expense"
			)

		company = self._resolve_company()

		# -----------------------
		# CREATE PURCHASE INVOICE
		# -----------------------

		pi = frappe.new_doc("Purchase Invoice")

		pi.supplier = supplier

		pi.company = company

		pi.set_posting_time = 1

		pi.posting_date = posting_date or frappe.utils.nowdate()

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
			# FETCH PAID ACCOUNT
			# -----------------------

			# Always use the selected Mode of Payment's account (Bank too),
			# not the company default bank account.
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

			pe.set_posting_time = 1

			pe.posting_date = pi.posting_date

			pe.mode_of_payment = mode_of_payment

			pe.job = self.name

			# -----------------------
			# SET REFERENCE DETAILS
			# -----------------------

			# Reference No/Date are not a feature the client wants to be asked
			# for at all — always fill them with safe defaults so ERPNext's
			# Bank-transaction validation never blocks submission, regardless
			# of the Mode of Payment/account type.
			pe.reference_no = reference_no or self.name
			pe.reference_date = reference_date or pi.posting_date

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

			# TEMP DIAGNOSTIC — remove once the "Reference No and Reference
			# Date is mandatory" reports are confirmed resolved. Lets us check
			# Desk > Error Log to see exactly what this deployed code actually
			# set right before insert, without needing server/terminal access.
			frappe.log_error(
				title="create_expense: PE ref fields before insert",
				message=(
					f"job={self.name} mode_of_payment={mode_of_payment} "
					f"paid_from={paid_account} reference_no={pe.reference_no} "
					f"reference_date={pe.reference_date}"
				),
			)

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
		reference_date=None,
		allocations=None,
		posting_date=None
	):

		if not amount:
			frappe.throw("Amount is required")

		# Book the advance against the SAME party the Sales Invoice will be
		# raised to — for agent jobs that is the agent's linked customer, NOT
		# self.customer. A mismatch leaves the advance unapplied and the job
		# stuck showing "Amount Pending".
		customer = (
			self.agent_customer
			if self.receivable_from == "Agent"
			else self.customer
		)

		if not customer:
			frappe.throw(
				_("Cannot create Advance Receipt: no {0} is set on this Job.").format(
					"Agent's linked Customer"
					if self.receivable_from == "Agent"
					else "Customer"
				)
			)

		pe = frappe.new_doc("Payment Entry")

		pe.payment_type = "Receive"

		pe.party_type = "Customer"

		pe.party = customer

		pe.company = self.company

		pe.set_posting_time = 1

		pe.posting_date = posting_date or frappe.utils.nowdate()

		pe.mode_of_payment = mode_of_payment

		pe.custom_job = self.name

		pe.job = self.name

		# ------------------------------------------------
		# Account Fetch
		# ------------------------------------------------

		# Always use the SELECTED Mode of Payment's account (for this company),
		# for Bank modes too — picking "RIYAD BANK" must post to its account
		# (e.g. 1202 Riyadh), not the company's default bank account.
		pe.paid_to = frappe.db.get_value(
			"Mode of Payment Account",
			{
				"parent": mode_of_payment,
				"company": self.company
			},
			"default_account"
		)

		if not pe.paid_to:
			pe.paid_to = (
				frappe.db.get_value("Company", self.company, "default_bank_account")
				or frappe.db.get_value("Account", {"company": self.company, "account_type": "Bank", "is_group": 0}, "name")
				or frappe.db.get_value("Company", self.company, "default_cash_account")
				or frappe.db.get_value("Account", {"company": self.company, "account_type": "Cash", "is_group": 0}, "name")
			)

		if not pe.paid_to:
			frappe.throw(
				f"No account found for Mode of Payment: {mode_of_payment}"
			)

		# Reference No/Date are not a feature the client wants to be asked for
		# at all — always fill them with safe defaults so ERPNext's
		# Bank-transaction validation never blocks submission, regardless of
		# the Mode of Payment/account type.
		pe.reference_no = reference_no or self.name
		pe.reference_date = reference_date or pe.posting_date

		# ------------------------------------------------
		# Amount
		# ------------------------------------------------

		pe.paid_amount = amount

		pe.received_amount = amount

		# ------------------------------------------------
		# ALLOCATE TO OPEN SALES INVOICES (optional)
		# Any remainder stays as an unallocated advance.
		# ------------------------------------------------

		import json

		if isinstance(allocations, str):
			allocations = json.loads(allocations or "[]")

		for row in (allocations or []):
			inv = row.get("invoice")
			alloc = flt(row.get("allocated_amount"))
			if not inv or alloc <= 0:
				continue
			pe.append("references", {
				"reference_doctype": "Sales Invoice",
				"reference_name": inv,
				"allocated_amount": alloc,
			})

		# Let ERPNext compute total_allocated_amount / unallocated_amount from
		# the references on validate (don't hard-set unallocated_amount).

		pe.insert(ignore_permissions=True)

		pe.submit()

		return pe.name





	@frappe.whitelist()
	def create_outsource_advance_payment(
		self,
		suppliers,
		mode_of_payment,
		reference_no=None,
		reference_date=None,
		posting_date=None
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

			pe.set_posting_time = 1

			pe.posting_date = posting_date or frappe.utils.nowdate()

			pe.mode_of_payment = mode_of_payment

			pe.custom_job = self.name

			pe.job = self.name

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
			# REFERENCE DETAILS
			# ----------------------------------------

			# Reference No/Date are not a feature the client wants to be asked
			# for at all — always fill them with safe defaults so ERPNext's
			# Bank-transaction validation never blocks submission, regardless
			# of the Mode of Payment/account type.
			pe.reference_no = reference_no or self.name
			pe.reference_date = reference_date or pe.posting_date

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

			# ----------------------------------------
			# ALLOCATE TO OPEN PURCHASE INVOICES (optional)
			# Any remainder stays as an unallocated advance.
			# ----------------------------------------

			for alloc_row in (row.get("allocations") or []):
				inv = alloc_row.get("invoice")
				alloc = flt(alloc_row.get("allocated_amount"))
				if not inv or alloc <= 0:
					continue
				pe.append("references", {
					"reference_doctype": "Purchase Invoice",
					"reference_name": inv,
					"allocated_amount": alloc,
				})

			# Let ERPNext compute total_allocated_amount / unallocated_amount
			# from the references on validate.

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

	# --------------------------------------------------------
	# RECONCILIATION HELPERS (for allocation dialogs)
	# --------------------------------------------------------

	@frappe.whitelist()
	def get_job_open_invoices(self, invoice_type, party=None):
		"""Open invoices (outstanding > 0) for this job, to allocate a payment
		against. invoice_type = 'Sales Invoice' or 'Purchase Invoice'."""
		party_field = "customer" if invoice_type == "Sales Invoice" else "supplier"
		job_field = "job" if frappe.db.has_column(invoice_type, "job") else "custom_job"
		conditions = f"{job_field} = %(job)s AND docstatus = 1 AND outstanding_amount > 0"
		params = {"job": self.name}
		if party:
			conditions += f" AND `{party_field}` = %(party)s"
			params["party"] = party
		return frappe.db.sql(
			f"""SELECT name, posting_date, grand_total, outstanding_amount,
					`{party_field}` AS party
				FROM `tab{invoice_type}`
				WHERE {conditions}
				ORDER BY posting_date, name""",
			params,
			as_dict=True,
		)

	@frappe.whitelist()
	def get_job_unallocated_payments(self, payment_type, party=None):
		"""Unallocated advance Payment Entries for this job, to apply to an
		invoice. payment_type = 'Receive' (customer) or 'Pay' (supplier)."""
		job_field = "job" if frappe.db.has_column("Payment Entry", "job") else "custom_job"
		conditions = (
			f"{job_field} = %(job)s AND docstatus = 1 AND payment_type = %(pt)s "
			"AND unallocated_amount > 0"
		)
		params = {"job": self.name, "pt": payment_type}
		if party:
			conditions += " AND party = %(party)s"
			params["party"] = party
		return frappe.db.sql(
			"""SELECT name, posting_date, party, paid_amount, unallocated_amount
				FROM `tabPayment Entry`
				WHERE """ + conditions + """
				ORDER BY posting_date, name""",
			params,
			as_dict=True,
		)

	# --------------------------------------------------------
	# JOB PROFIT & PAYMENT TRACKING
	# --------------------------------------------------------

	@frappe.whitelist()
	def get_financials(self):
		"""Return per-job financial metrics from the GL (Job accounting
		dimension), Payment Entries and Sales Invoices. Profit is EX-VAT
		(tax accounts are Liability/Asset and are excluded automatically);
		Agent Commission is NOT subtracted from Net Profit. Each metric is
		flagged visible/hidden per JMS Settings."""

		company = self.company or frappe.defaults.get_user_default("company")
		settings = frappe.get_cached_doc("JMS Settings")
		outsourcing_acct = get_outsourcing_cost_account(company)
		job = self.name
		has_gle_job = frappe.db.has_column("GL Entry", "job")
		pe_job_field = "job" if frappe.db.has_column("Payment Entry", "job") else "custom_job"
		si_job_field = "job" if frappe.db.has_column("Sales Invoice", "job") else "custom_job"
		pi_job_field = "job" if frappe.db.has_column("Purchase Invoice", "job") else "custom_job"

		def _gl_sum(root_type=None, account=None, exclude_account=None):
			if not has_gle_job:
				return 0.0
			conditions = "gle.job = %(job)s AND gle.is_cancelled = 0"
			params = {"job": job}
			if root_type:
				conditions += " AND a.root_type = %(root_type)s"
				params["root_type"] = root_type
			if account:
				conditions += " AND gle.account = %(account)s"
				params["account"] = account
			if exclude_account:
				conditions += " AND gle.account != %(exclude_account)s"
				params["exclude_account"] = exclude_account
			sign = "gle.credit - gle.debit" if root_type == "Income" else "gle.debit - gle.credit"
			return flt(frappe.db.sql(
				f"""SELECT COALESCE(SUM({sign}), 0)
					FROM `tabGL Entry` gle
					JOIN `tabAccount` a ON a.name = gle.account
					WHERE {conditions}""",
				params,
			)[0][0])

		# 1. Total Job Amount (ex-VAT) = the job's billable value from its priced
		# items (gross_amount = sum of line totals before VAT). This is known as
		# soon as the job is priced, so it shows even before any Sales Invoice
		# exists. Fall back to posted GL income only if the job carries no
		# priced items (e.g. invoice raised directly without item pricing).
		total_job_amount = flt(self.gross_amount) or _gl_sum(root_type="Income")

		# 5. Outsourcing Costs = the dedicated account
		outsourcing_cost = _gl_sum(account=outsourcing_acct) if outsourcing_acct else 0.0

		# 4. Total Expenses = all expense accounts EXCEPT outsourcing
		total_expenses = _gl_sum(root_type="Expense", exclude_account=outsourcing_acct)

		# 6. Net Profit = #1 - #4 - #5  (commission excluded by decision)
		net_profit = total_job_amount - total_expenses - outsourcing_cost

		# 2. Total Amount Received (Payment Entry, Receive; includes advances)
		total_received = flt(frappe.db.sql(
			f"""SELECT COALESCE(SUM(pe.paid_amount), 0)
				FROM `tabPayment Entry` pe
				WHERE pe.{pe_job_field} = %(job)s AND pe.docstatus = 1
				  AND pe.payment_type = 'Receive'""",
			{"job": job},
		)[0][0])

		# Customer vs Agent split (agents pay via their linked customer, so
		# compare party to agent_customer — party_type is always 'Customer')
		received_from_agent = 0.0
		if self.agent_customer:
			received_from_agent = flt(frappe.db.sql(
				f"""SELECT COALESCE(SUM(pe.paid_amount), 0)
					FROM `tabPayment Entry` pe
					WHERE pe.{pe_job_field} = %(job)s AND pe.docstatus = 1
					  AND pe.payment_type = 'Receive'
					  AND pe.party = %(party)s""",
				{"job": job, "party": self.agent_customer},
			)[0][0])
		received_from_customer = total_received - received_from_agent

		# 3. Outstanding to Receive (Sales Invoice outstanding by job)
		outstanding = flt(frappe.db.sql(
			f"""SELECT COALESCE(SUM(si.outstanding_amount), 0)
				FROM `tabSales Invoice` si
				WHERE si.{si_job_field} = %(job)s AND si.docstatus = 1""",
			{"job": job},
		)[0][0])

		# Has this job been billed yet (a submitted Sales Invoice exists)?
		has_sales_invoice = bool(
			frappe.db.count("Sales Invoice", {si_job_field: job, "docstatus": 1})
		)

		# Paid Out for this job = ALL pay-side Payment Entries (incl. unallocated
		# supplier / agent advances), not only those allocated to Purchase
		# Invoices — otherwise outgoing advance payments are invisible.
		paid_out = flt(frappe.db.sql(
			f"""SELECT COALESCE(SUM(pe.paid_amount), 0)
				FROM `tabPayment Entry` pe
				WHERE pe.{pe_job_field} = %(job)s AND pe.docstatus = 1
				  AND pe.payment_type = 'Pay'""",
			{"job": job},
		)[0][0])

		# Unpaid payables (Exp. Pending indicator + Profit Balance)
		payable_outstanding = flt(frappe.db.sql(
			f"""SELECT COALESCE(SUM(pi.outstanding_amount), 0)
				FROM `tabPurchase Invoice` pi
				WHERE pi.{pi_job_field} = %(job)s AND pi.docstatus = 1""",
			{"job": job},
		)[0][0])

		# Advances tagged to this job that are NOT yet applied to an invoice.
		# A job whose advance simply wasn't auto-linked (e.g. party mismatch on
		# older data) would otherwise stay flagged "pending" forever, so we net
		# the unallocated advance against the gross invoice outstanding.
		unallocated_received = flt(frappe.db.sql(
			f"""SELECT COALESCE(SUM(pe.unallocated_amount), 0)
				FROM `tabPayment Entry` pe
				WHERE pe.{pe_job_field} = %(job)s AND pe.docstatus = 1
				  AND pe.payment_type = 'Receive'""",
			{"job": job},
		)[0][0])
		unallocated_paid = flt(frappe.db.sql(
			f"""SELECT COALESCE(SUM(pe.unallocated_amount), 0)
				FROM `tabPayment Entry` pe
				WHERE pe.{pe_job_field} = %(job)s AND pe.docstatus = 1
				  AND pe.payment_type = 'Pay'""",
			{"job": job},
		)[0][0])

		# Net amounts still to collect / pay after offsetting those advances —
		# the basis for the "Amount Pending" / "Exp. Pending" indicators and the
		# Job Status Report "remaining" scenarios.
		net_receivable = max(0.0, outstanding - unallocated_received)
		net_payable = max(0.0, payable_outstanding - unallocated_paid)

		# 7. Profit Balance = profit still to settle = remaining receivable minus
		# remaining payable. Trends to zero as the job is fully collected/paid.
		profit_balance = net_receivable - net_payable

		currency = frappe.get_cached_value("Company", company, "default_currency") if company else None

		metric_defs = [
			("total_job_amount", "Total Job Amount", total_job_amount, settings.show_total_job_amount),
			("total_received", "Total Amount Received", total_received, settings.show_total_received),
			("outstanding", "Outstanding to Receive", outstanding, settings.show_outstanding),
			("total_expenses", "Total Expenses", total_expenses, settings.show_total_expenses),
			("outsourcing_cost", "Outsourcing Costs", outsourcing_cost, settings.show_outsourcing_cost),
			("paid_out", "Paid Out (Supplier/Agent)", paid_out, getattr(settings, "show_paid_out", 1)),
			("net_profit", "Net Profit", net_profit, settings.show_net_profit),
			("profit_balance", "Profit Balance", profit_balance, settings.show_profit_balance),
		]

		return {
			"currency": currency,
			"metrics": [
				{"key": k, "label": l, "value": v, "visible": bool(vis)}
				for (k, l, v, vis) in metric_defs
			],
			"received_from": self.receivable_from,
			"received_from_customer": received_from_customer,
			"received_from_agent": received_from_agent,
			"net_receivable": net_receivable,
			"has_sales_invoice": has_sales_invoice,
			"net_payable": net_payable,
			"indicators": {
				"show": bool(settings.show_status_indicators),
				"amount_pending": bool(net_receivable > 0) and bool(settings.enable_amount_pending_indicator),
				"exp_pending": bool(net_payable > 0) and bool(settings.enable_exp_pending_indicator),
			},
		}


# ============================================================
# MODULE-LEVEL HELPERS (Job Profit & Payment Tracking)
# ============================================================

def get_outsourcing_cost_account(company):
	"""Return the dedicated Outsourcing Cost expense account for a company.

	Prefers JMS Settings (when configured); falls back to lookup by the
	standard account name created by the Phase 1 setup patch. Returns None
	if not found, in which case ERPNext uses the item's default expense
	account (preserves prior behaviour).
	"""
	account = None
	if frappe.db.exists("DocType", "JMS Settings"):
		account = frappe.db.get_single_value(
			"JMS Settings", "outsourcing_cost_account"
		)
	if not account:
		account = frappe.db.get_value(
			"Account",
			{
				"account_name": "Outsourcing Cost",
				"company": company,
				"is_group": 0,
			},
			"name",
		)
	return account


	















