# Copyright (c) 2026, Kenz and contributors
# Startup data for the SBM frontend: who is logged in and what they may see.

import frappe
from frappe.sessions import get_csrf_token

from jms.desk_access import can_use_desk
from jms.jms.doctype.job.job import is_office_user, is_task_staff_only

# JMS Settings flags the frontend needs to show or hide money figures.
SETTING_FLAGS = (
	"show_total_job_amount", "show_total_received", "show_outstanding",
	"show_total_expenses", "show_outsourcing_cost", "show_paid_out",
	"show_expense_returns", "show_payment_returns", "show_net_profit",
	"show_profit_balance", "show_status_indicators",
	"enable_amount_pending_indicator", "enable_exp_pending_indicator",
)


@frappe.whitelist()
def get_boot():
	"""Called once when the app starts. Task Staff get no company or settings."""
	user = frappe.session.user
	office = is_office_user(user)
	return {
		"user": user,
		"full_name": frappe.utils.get_fullname(user),
		"roles": frappe.get_roles(user),
		"is_office": office,
		"is_task_staff": is_task_staff_only(user),
		# may open the ERPNext desk (System Manager or Admin, see desk_access.py)
		"desk": can_use_desk(user),
		# Employee records of this user; their tasks are the ones assigned to these.
		"employees": frappe.get_all("Employee", filters={"user_id": user}, pluck="name"),
		**(_office_data() if office else {}),
		# Only for the Vite dev server, which does not load sbm.html (that page sets it).
		**({"csrf_token": get_csrf_token()} if frappe.conf.developer_mode else {}),
	}


def _office_data():
	settings = frappe.get_cached_doc("JMS Settings")
	company = (
		settings.default_company
		or frappe.defaults.get_user_default("company")
		or frappe.db.get_single_value("Global Defaults", "default_company")
	)
	return {
		"company": company,
		"currency": frappe.get_cached_value("Company", company, "default_currency") if company else None,
		# A flag never saved on the Single is None: treat it as on, like get_financials.
		"settings": {f: 1 if settings.get(f) is None else int(settings.get(f)) for f in SETTING_FLAGS},
	}
