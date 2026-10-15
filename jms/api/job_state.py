# Copyright (c) 2026, Kenz and contributors
# Where a Job stands and what can be done next. The frontend shows buttons from
# this; the actions themselves are the Job methods, called with run_doc_method.

import frappe
from frappe import _

from jms.jms.doctype.job.job import LOCKED_JOB_STATUSES, is_office_user

DEAD_STATUSES = ("Cancelled", "Canceled", "Rejected")

# Action key → Job method to call through /api/method/run_doc_method.
# close / cancel have no method: the frontend saves the Job with that status.
ACTION_METHODS = {
	"advance_receipt": "create_advance_receipt",
	"sales_invoice": "create_invoice",
	"purchase_invoice": "create_pinvoice",
	"outsource_advance": "create_outsource_advance_payment",
	"expense": "create_expense",
	"expense_return": "create_expense_return",
	"payment_return": "create_payment_return",
	"close": None,
	"cancel": None,
}

# Next-step candidates per stage, first allowed one wins.
NEXT_STEPS = {
	"Invoice Pending": ("sales_invoice",),
	"Amount Pending": ("advance_receipt",),
	"Exp Pending": ("purchase_invoice", "outsource_advance"),
	"Completed": ("purchase_invoice", "close"),
}


@frappe.whitelist()
def get_job_state(job):
	"""Everything the Job page header needs in one call: stage, next step,
	allowed actions and the money figures."""
	if not is_office_user():
		frappe.throw(_("You are not permitted to do this"), frappe.PermissionError)
	doc = frappe.get_doc("Job", job)
	doc.check_permission("read")

	fin = doc.get_financials()
	tasks_done = all(t.status == "Completed" for t in doc.tasks)
	stage = get_stage(doc.status, tasks_done, fin["has_sales_invoice"], fin["net_receivable"], fin["net_payable"])
	actions = get_actions(doc, fin["has_sales_invoice"])
	return {
		"stage": stage,
		"next_action": get_next_action(stage, actions, doc.status, has_unbilled_outsource(doc)),
		"actions": [{"key": key, "method": ACTION_METHODS[key]} for key in actions],
		"financials": fin,
	}


def get_stage(status, tasks_done, has_sales_invoice, net_receivable, net_payable):
	"""Work & money stage, the same rule as the stepper on the Job form."""
	if status in DEAD_STATUSES:
		return status
	if not tasks_done:
		return "Processing Work"
	if not has_sales_invoice:
		return "Invoice Pending"
	if net_receivable > 0:
		return "Amount Pending"
	if net_payable > 0:
		return "Exp Pending"
	return "Completed"


def get_actions(doc, has_sales_invoice=None):
	"""Allowed action keys, in the order and with the conditions of the Create menu
	on the ERPNext Job form (job.js refresh):
	- Outsource Advance Payment: an Outsource task with a supplier;
	- Advance Receipt, Payment Return, Create Sales Invoice, Create Expense and
	  Expense Return: always (a second sales invoice is refused when it is opened);
	- Create Purchase Invoice: any Outsource task (when all are billed it says so);
	- Close Job: not Closed, Cancelled or Rejected; Cancel: also not Completed.
	SI Payment is left out: it calls a create_payment method that does not exist."""
	outsourced = [t for t in doc.tasks if t.employee__outsource == "Outsource"]

	actions = []
	if any(t.outsource_supplier for t in outsourced):
		actions.append("outsource_advance")
	actions += ["advance_receipt", "payment_return", "sales_invoice", "expense", "expense_return"]
	if outsourced:
		actions.append("purchase_invoice")
	if doc.status not in LOCKED_JOB_STATUSES:
		actions.append("close")
	if doc.status not in (*LOCKED_JOB_STATUSES, "Completed"):
		actions.append("cancel")
	return actions


def has_unbilled_outsource(doc):
	return any(t.employee__outsource == "Outsource" and not t.purchase_invoice for t in doc.tasks)


def get_next_action(stage, actions, status=None, unbilled_outsource=False):
	"""The one main button. "tasks" means: go to the Tasks tab. None for a Closed or
	dead Job. A purchase invoice is only next while an outsourced task is unbilled."""
	if status == "Closed" or status in DEAD_STATUSES:
		return None
	if stage == "Processing Work":
		return "tasks"
	return next(
		(
			key
			for key in NEXT_STEPS.get(stage, ())
			if key in actions and (key != "purchase_invoice" or unbilled_outsource)
		),
		None,
	)
