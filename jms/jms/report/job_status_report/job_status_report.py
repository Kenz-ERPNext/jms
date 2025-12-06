# Copyright (c) 2025, Your Company and contributors
# For license information, please see license.txt

import frappe
from frappe import _


def execute(filters=None):
	columns = get_columns()
	data = get_data(filters)
	return columns, data


def get_columns():
	return [
		{
			"fieldname": "name",
			"label": _("Job ID"),
			"fieldtype": "Link",
			"options": "Job",
			"width": 150
		},
		{
			"fieldname": "job_title",
			"label": _("Job Title"),
			"fieldtype": "Data",
			"width": 200
		},
		{
			"fieldname": "customer",
			"label": _("Customer"),
			"fieldtype": "Link",
			"options": "Customer",
			"width": 150
		},
		{
			"fieldname": "job_type",
			"label": _("Job Type"),
			"fieldtype": "Link",
			"options": "Job Type",
			"width": 120
		},
		{
			"fieldname": "priority",
			"label": _("Priority"),
			"fieldtype": "Data",
			"width": 100
		},
		{
			"fieldname": "status",
			"label": _("Status"),
			"fieldtype": "Data",
			"width": 120
		},
		{
			"fieldname": "start_date",
			"label": _("Start Date"),
			"fieldtype": "Date",
			"width": 100
		},
		{
			"fieldname": "expected_end_date",
			"label": _("Expected End Date"),
			"fieldtype": "Date",
			"width": 120
		},
		{
			"fieldname": "actual_end_date",
			"label": _("Actual End Date"),
			"fieldtype": "Date",
			"width": 120
		},
		{
			"fieldname": "total_amount",
			"label": _("Amount"),
			"fieldtype": "Currency",
			"width": 120
		},
		{
			"fieldname": "billing_status",
			"label": _("Billing Status"),
			"fieldtype": "Data",
			"width": 120
		}
	]


def get_data(filters):
	conditions = []

	if filters.get("status"):
		conditions.append(f"status = '{filters.get('status')}'")

	if filters.get("job_type"):
		conditions.append(f"job_type = '{filters.get('job_type')}'")

	if filters.get("customer"):
		conditions.append(f"customer = '{filters.get('customer')}'")

	if filters.get("from_date"):
		conditions.append(f"start_date >= '{filters.get('from_date')}'")

	if filters.get("to_date"):
		conditions.append(f"start_date <= '{filters.get('to_date')}'")

	where_clause = " AND ".join(conditions) if conditions else "1=1"

	data = frappe.db.sql(f"""
		SELECT
			name,
			job_title,
			customer,
			job_type,
			priority,
			status,
			start_date,
			expected_end_date,
			actual_end_date,
			total_amount,
			billing_status
		FROM
			`tabJob`
		WHERE
			{where_clause}
		ORDER BY
			creation DESC
	""", as_dict=1)

	return data
