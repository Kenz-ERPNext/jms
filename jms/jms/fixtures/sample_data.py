# -*- coding: utf-8 -*-
# Copyright (c) 2025, Your Company and contributors
# For license information, please see license.txt

import frappe
from frappe import _


def install_sample_data():
	"""Install sample data for JMS"""
	frappe.flags.in_install = True

	create_job_types()
	create_job_natures()
	create_job_sources()
	create_agents()
	create_outsourced_parties()
	create_work_templates()

	frappe.db.commit()
	frappe.flags.in_install = False

	frappe.msgprint(_("Sample data installed successfully!"))


def create_job_types():
	"""Create sample job types"""
	job_types = [
		{
			"job_type_name": "Company Formation",
			"description": "Company registration and formation services",
			"default_duration_days": 14,
			"is_active": 1
		},
		{
			"job_type_name": "Visa Processing",
			"description": "Visa application and processing services",
			"default_duration_days": 30,
			"is_active": 1
		},
		{
			"job_type_name": "Audit Services",
			"description": "Annual and special audit services",
			"default_duration_days": 21,
			"is_active": 1
		},
		{
			"job_type_name": "Tax Filing",
			"description": "Tax return filing and compliance",
			"default_duration_days": 7,
			"is_active": 1
		},
		{
			"job_type_name": "Business License",
			"description": "Business license and permit services",
			"default_duration_days": 10,
			"is_active": 1
		}
	]

	for job_type in job_types:
		if not frappe.db.exists("Job Type", job_type["job_type_name"]):
			doc = frappe.get_doc({
				"doctype": "Job Type",
				**job_type
			})
			doc.insert(ignore_permissions=True)
			print(f"Created Job Type: {job_type['job_type_name']}")


def create_job_natures():
	"""Create sample job natures"""
	job_natures = [
		{"nature_name": "Basic", "job_type": "Company Formation"},
		{"nature_name": "Premium", "job_type": "Company Formation"},
		{"nature_name": "Express", "job_type": "Company Formation"},
		{"nature_name": "Tourist Visa", "job_type": "Visa Processing"},
		{"nature_name": "Business Visa", "job_type": "Visa Processing"},
		{"nature_name": "Work Permit", "job_type": "Visa Processing"},
		{"nature_name": "Annual Audit", "job_type": "Audit Services"},
		{"nature_name": "Special Audit", "job_type": "Audit Services"},
		{"nature_name": "Individual Tax", "job_type": "Tax Filing"},
		{"nature_name": "Corporate Tax", "job_type": "Tax Filing"},
		{"nature_name": "Trade License", "job_type": "Business License"},
		{"nature_name": "Professional License", "job_type": "Business License"}
	]

	for nature in job_natures:
		name = f"{nature['job_type']}-{nature['nature_name']}"
		if not frappe.db.exists("Job Nature", name):
			doc = frappe.get_doc({
				"doctype": "Job Nature",
				**nature
			})
			doc.insert(ignore_permissions=True)
			print(f"Created Job Nature: {name}")


def create_job_sources():
	"""Create sample job sources"""
	job_sources = [
		{"source_name": "Walk-in", "is_agent_required": 0},
		{"source_name": "Referral", "is_agent_required": 1},
		{"source_name": "Website", "is_agent_required": 0},
		{"source_name": "Phone Call", "is_agent_required": 0},
		{"source_name": "Email Inquiry", "is_agent_required": 0},
		{"source_name": "Social Media", "is_agent_required": 0},
		{"source_name": "Agent Network", "is_agent_required": 1}
	]

	for source in job_sources:
		if not frappe.db.exists("Job Source", source["source_name"]):
			doc = frappe.get_doc({
				"doctype": "Job Source",
				**source
			})
			doc.insert(ignore_permissions=True)
			print(f"Created Job Source: {source['source_name']}")


def create_agents():
	"""Create sample agents"""
	agents = [
		{
			"agent_name": "Ahmed Ali",
			"mobile": "+971-50-123-4567",
			"email": "ahmed.ali@example.com",
			"commission_type": "Percentage",
			"commission_rate": 10,
			"is_active": 1
		},
		{
			"agent_name": "Sarah Mohammed",
			"mobile": "+971-50-234-5678",
			"email": "sarah.mohammed@example.com",
			"commission_type": "Percentage",
			"commission_rate": 15,
			"is_active": 1
		},
		{
			"agent_name": "John Smith",
			"mobile": "+971-50-345-6789",
			"email": "john.smith@example.com",
			"commission_type": "Fixed Amount",
			"commission_rate": 500,
			"is_active": 1
		},
		{
			"agent_name": "Fatima Hassan",
			"mobile": "+971-50-456-7890",
			"email": "fatima.hassan@example.com",
			"commission_type": "Percentage",
			"commission_rate": 12,
			"is_active": 1
		}
	]

	for agent in agents:
		if not frappe.db.exists("Agent", agent["agent_name"]):
			doc = frappe.get_doc({
				"doctype": "Agent",
				**agent
			})
			doc.insert(ignore_permissions=True)
			print(f"Created Agent: {agent['agent_name']}")


def create_outsourced_parties():
	"""Create sample outsourced parties"""
	parties = [
		{
			"party_name": "Legal Services LLC",
			"mobile": "+971-4-123-4567",
			"email": "info@legalservices.ae",
			"is_active": 1
		},
		{
			"party_name": "Document Processing Center",
			"mobile": "+971-4-234-5678",
			"email": "contact@docprocessing.ae",
			"is_active": 1
		},
		{
			"party_name": "PRO Services Dubai",
			"mobile": "+971-4-345-6789",
			"email": "pro@proservices.ae",
			"is_active": 1
		}
	]

	for party in parties:
		if not frappe.db.exists("Outsourced Party", party["party_name"]):
			doc = frappe.get_doc({
				"doctype": "Outsourced Party",
				**party
			})
			doc.insert(ignore_permissions=True)
			print(f"Created Outsourced Party: {party['party_name']}")


def create_work_templates():
	"""Create sample work templates with sub-tasks"""
	templates = [
		{
			"template_code": "111",
			"description": "Company Registration",
			"job_type": "Company Formation",
			"job_qty": 1,
			"fee_price": 35000,
			"extra": 0,
			"surcharge": 6000,
			"vat": 0,
			"status": "CREATED",
			"is_active": 1,
			"has_sub_tasks": 1,
			"sub_tasks": [
				{"task_name": "Collect Required Documents", "due_days": 0, "status": "Pending"},
				{"task_name": "Verify Documents", "due_days": 1, "status": "Pending"},
				{"task_name": "Submit to Authorities", "due_days": 3, "status": "Pending"},
				{"task_name": "Follow up on Application", "due_days": 7, "status": "Pending"},
				{"task_name": "Collect License", "due_days": 14, "status": "Pending"}
			]
		},
		{
			"template_code": "114",
			"description": "Counter Charge",
			"job_type": "Company Formation",
			"job_qty": 1,
			"fee_price": 0,
			"extra": 0,
			"surcharge": 0,
			"vat": 0,
			"status": "CREATED",
			"is_active": 1,
			"has_sub_tasks": 0
		},
		{
			"template_code": "108",
			"description": "VISA",
			"job_type": "Visa Processing",
			"job_qty": 1,
			"fee_price": 0,
			"extra": 10000,
			"surcharge": 0,
			"vat": 0,
			"status": "CREATED",
			"is_active": 1,
			"has_sub_tasks": 1,
			"sub_tasks": [
				{"task_name": "Collect Passport & Photos", "due_days": 0, "status": "Pending"},
				{"task_name": "Complete Application Form", "due_days": 1, "status": "Pending"},
				{"task_name": "Submit to Immigration", "due_days": 3, "status": "Pending"},
				{"task_name": "Medical & Emirates ID", "due_days": 10, "status": "Pending"},
				{"task_name": "Visa Stamping", "due_days": 30, "status": "Pending"}
			]
		},
		{
			"template_code": "102",
			"description": "ONLINE SERVICES",
			"job_type": "Business License",
			"job_qty": 1,
			"fee_price": 0,
			"extra": 0,
			"surcharge": 20000,
			"vat": 0,
			"status": "CREATED",
			"is_active": 1,
			"has_sub_tasks": 0
		},
		{
			"template_code": "111A",
			"description": "Company Purchase",
			"job_type": "Company Formation",
			"job_qty": 1,
			"fee_price": 15000,
			"extra": 0,
			"surcharge": 0,
			"vat": 0,
			"status": "CREATED",
			"is_active": 1,
			"has_sub_tasks": 1,
			"sub_tasks": [
				{"task_name": "Due Diligence", "due_days": 0, "status": "Pending"},
				{"task_name": "Share Transfer Documents", "due_days": 3, "status": "Pending"},
				{"task_name": "MOA Amendment", "due_days": 7, "status": "Pending"},
				{"task_name": "License Transfer", "due_days": 14, "status": "Pending"}
			]
		}
	]

	for template in templates:
		if not frappe.db.exists("Work Template", template["template_code"]):
			sub_tasks = template.pop("sub_tasks", [])
			doc = frappe.get_doc({
				"doctype": "Work Template",
				**template
			})

			# Add sub-tasks
			for sub_task in sub_tasks:
				doc.append("sub_tasks", sub_task)

			doc.insert(ignore_permissions=True)
			print(f"Created Work Template: {template['template_code']} - {template['description']}")


@frappe.whitelist()
def create_sample_jobs():
	"""Create sample jobs for demonstration"""
	import random
	from frappe.utils import add_days, today

	# Get customers or create sample customer
	customers = frappe.get_all("Customer", limit=5)
	if not customers:
		# Create a sample customer
		customer = frappe.get_doc({
			"doctype": "Customer",
			"customer_name": "Sample Customer LLC",
			"customer_type": "Company"
		})
		customer.insert(ignore_permissions=True)
		customers = [{"name": customer.name}]

	job_types = frappe.get_all("Job Type", pluck="name")
	agents = frappe.get_all("Agent", pluck="name")
	work_templates = frappe.get_all("Work Template", pluck="name")

	if not job_types or not work_templates:
		frappe.throw(_("Please create Job Types and Work Templates first"))

	statuses = ["CREATED", "PROCESSING", "AMT_PENDING(COMPLETED)"]
	priorities = ["Low", "Medium", "High", "Urgent"]

	for i in range(5):
		job = frappe.get_doc({
			"doctype": "Job",
			"job_title": f"Sample Job {i+1}",
			"customer": random.choice(customers)["name"],
			"job_type": random.choice(job_types),
			"priority": random.choice(priorities),
			"status": random.choice(statuses),
			"start_date": add_days(today(), -random.randint(1, 30)),
			"expected_completion_date": add_days(today(), random.randint(1, 30))
		})

		# Add random work templates as items
		for _ in range(random.randint(1, 3)):
			template = frappe.get_doc("Work Template", random.choice(work_templates))
			job.append("items", {
				"work_template": template.name,
				"description": template.description,
				"job_qty": 1,
				"fee_price": template.fee_price,
				"extra": template.extra,
				"surcharge": template.surcharge,
				"vat": template.vat
			})

		# Add agent sometimes
		if agents and random.choice([True, False]):
			job.agent = random.choice(agents)

		job.insert(ignore_permissions=True)
		print(f"Created sample job: {job.name}")

	frappe.db.commit()
	return {"message": "Sample jobs created successfully"}


def clear_sample_data():
	"""Clear all sample data"""
	frappe.db.sql("DELETE FROM `tabJob Item`")
	frappe.db.sql("DELETE FROM `tabJob Task`")
	frappe.db.sql("DELETE FROM `tabJob Staff Assignment`")
	frappe.db.sql("DELETE FROM `tabJob Document`")
	frappe.db.sql("DELETE FROM `tabJob`")
	frappe.db.sql("DELETE FROM `tabWork Template Sub Task`")
	frappe.db.sql("DELETE FROM `tabWork Template`")
	frappe.db.sql("DELETE FROM `tabOutsourced Party`")
	frappe.db.sql("DELETE FROM `tabAgent`")
	frappe.db.sql("DELETE FROM `tabJob Source`")
	frappe.db.sql("DELETE FROM `tabJob Nature`")
	frappe.db.sql("DELETE FROM `tabJob Type`")
	frappe.db.commit()
	frappe.msgprint(_("Sample data cleared successfully!"))
