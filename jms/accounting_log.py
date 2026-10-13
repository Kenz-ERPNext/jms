# Copyright (c) 2026, Kenz and contributors
# Accounting Change Log: a plain-language, live log of every change made to
# accounting documents, written for the client rather than for developers.
# See docs/ACCOUNTING_CHANGE_LOG.md.

import frappe
from frappe import _
from frappe.utils import cint, cstr, flt, get_fullname, strip_html

LOG_DOCTYPE = "Accounting Change Log"
REALTIME_EVENT = "accounting_change_log"

# The documents whose changes are logged. Transactions first, then the masters
# that decide where the money is booked.
ACCOUNTING_DOCTYPES = {
	"Sales Invoice",
	"Purchase Invoice",
	"Payment Entry",
	"Journal Entry",
	"Payment Request",
	"Period Closing Voucher",
	"Account",
	"Cost Center",
	"Bank Account",
	"Mode of Payment",
	"Fiscal Year",
	"Sales Taxes and Charges Template",
	"Purchase Taxes and Charges Template",
}

# Documents that are not accounting documents but carry the amounts that get
# billed. Only edits that change money are logged for them: their money fields,
# and the child tables named here.
MONEY_ONLY_DOCTYPES = {
	"Job": {"items"},
}
MONEY_FIELDTYPES = {"Currency", "Float", "Percent"}

# Fields that change as a side effect of the fields a person edits (company
# currency copies, totals in words, internal bookkeeping). Showing them would
# bury the real change.
NOISE_FIELDS = {
	"modified", "modified_by", "idx", "docstatus", "amended_from", "naming_series",
	"conversion_factor", "stock_qty", "stock_uom_rate", "net_rate", "net_amount",
	"valuation_rate", "incoming_rate", "grant_commission", "page_break",
	"item_tax_rate", "pricing_rules", "margin_rate_or_amount", "rate_with_margin",
	"amount_in_account_currency", "debit_in_account_currency", "credit_in_account_currency",
	"lft", "rgt", "old_parent", "in_words", "posting_time",
	# totals worked out from the lines; Grand Total / Rounded Total stay
	"total", "net_total", "outstanding_amount", "amount_eligible_for_commission",
	"rounding_adjustment",
}
# Child tables worked out from the rest of the document.
NOISE_TABLES = {"payment_schedule"}
SKIP_FIELDTYPES = {"Password", "Attach Image", "Signature", "Table", "Table MultiSelect"}
MAX_VALUE_LENGTH = 140

# Translated when the summary is written, not at import.
VERBS = {
	"Created": "created",
	"Amended": "created an amendment",
	"Edited": "edited",
	"Submitted": "submitted",
	"Edited after Submit": "edited submitted",
	"Cancelled": "cancelled",
	"Deleted": "deleted",
}


def log_accounting_change(doc, method=None):
	"""Registered for all doctypes under "*" in hooks.py; only the doctypes in
	ACCOUNTING_DOCTYPES and MONEY_ONLY_DOCTYPES are logged. Logging must never stop the change itself,
	so any failure goes to the Error Log."""
	flags = frappe.flags
	if doc.doctype not in ACCOUNTING_DOCTYPES | MONEY_ONLY_DOCTYPES.keys() or flags.in_install or flags.in_migrate or flags.in_patch:
		return

	try:
		entry = _entry_for(doc, method)
		if entry:
			_write(doc, *entry)
	except Exception:
		frappe.log_error(
			title=f"Accounting Change Log failed: {doc.doctype} {doc.name}",
			message=frappe.get_traceback(),
		)


def _entry_for(doc, method):
	"""Return (action, change lines) for this event, or None if nothing to log."""
	if doc.doctype in MONEY_ONLY_DOCTYPES and method != "on_update":
		return None

	if method == "after_insert":
		# A document inserted straight as submitted is logged once, by on_submit.
		if doc.docstatus == 1:
			return None
		return ("Amended" if doc.get("amended_from") else "Created"), []

	if method == "on_submit":
		return "Submitted", []

	if method == "on_cancel":
		return "Cancelled", []

	if method == "on_trash":
		return "Deleted", []

	if method in ("on_update", "on_update_after_submit"):
		before = doc.get_doc_before_save()
		# New records are logged by after_insert; a submit also runs on_update
		# and is logged by on_submit.
		if not before or before.docstatus != doc.docstatus:
			return None
		lines = change_lines(before, doc)
		if not lines:
			return None
		return ("Edited after Submit" if method == "on_update_after_submit" else "Edited"), lines

	return None


def _write(doc, action, lines):
	user = frappe.session.user
	user_name = get_fullname(user)
	party = _party(doc)
	amount, currency = _amount(doc)

	summary = f"{user_name} {_(VERBS[action])} {_(doc.doctype)} {doc.name}"
	if action == "Amended":
		summary += " " + _("(replacing {0})").format(doc.amended_from)
	if party:
		summary += " " + _("for {0}").format(party)

	log = frappe.get_doc(
		{
			"doctype": LOG_DOCTYPE,
			"action": action,
			"reference_doctype": doc.doctype,
			"reference_name": doc.name,
			"document_date": doc.get("posting_date") or doc.get("transaction_date"),
			"changed_by": user,
			"changed_by_name": user_name,
			"company": doc.get("company"),
			"job": doc.name if doc.doctype == "Job" else doc.get("job"),
			"party": party,
			"amount": amount,
			"currency": currency,
			"summary": summary,
			"details": "\n".join(lines),
		}
	).insert(ignore_permissions=True)

	# Pushed only to users who may read the log (Frappe checks read permission
	# before a browser joins the doctype room), and only once the change is
	# committed, so a rolled-back save never shows up.
	frappe.publish_realtime(
		REALTIME_EVENT,
		log.as_dict(convert_dates_to_str=True),
		doctype=LOG_DOCTYPE,
		after_commit=True,
	)


def _party(doc):
	for field in ("customer_name", "supplier_name", "party_name", "customer", "supplier", "party"):
		if doc.get(field):
			return cstr(doc.get(field))
	if doc.doctype == "Journal Entry":
		return cstr(doc.get("title") or "")
	return ""


def _amount(doc):
	if doc.doctype == "Payment Entry":
		if doc.get("payment_type") == "Receive":
			return flt(doc.get("received_amount")), doc.get("paid_to_account_currency")
		return flt(doc.get("paid_amount")), doc.get("paid_from_account_currency")
	if doc.doctype == "Journal Entry":
		return flt(doc.get("total_debit")), _company_currency(doc)
	for field in ("rounded_total", "grand_total", "grand_total_amount", "net_amount"):
		if doc.get(field):
			return flt(doc.get(field)), doc.get("currency") or _company_currency(doc)
	return None, None


def _company_currency(doc):
	return doc.get("company") and frappe.get_cached_value("Company", doc.company, "default_currency")


def change_lines(before, doc):
	"""One readable line per changed field, e.g. "Rate (Items row 2): 100.00 → 120.00"."""
	from frappe.core.doctype.version.version import get_diff

	diff = get_diff(before, doc)
	if not diff:
		return []

	money_tables = MONEY_ONLY_DOCTYPES.get(doc.doctype)
	if money_tables is not None:
		diff.row_changed = [c for c in diff.row_changed if c[0] in money_tables]
		diff.added = [c for c in diff.added if c[0] in money_tables]
		diff.removed = [c for c in diff.removed if c[0] in money_tables]

	lines = []
	for field, old, new in diff.changed:
		df = doc.meta.get_field(field)
		if money_tables is not None:
			shown = df and not df.hidden and df.fieldtype in MONEY_FIELDTYPES
		else:
			shown = _is_shown(df)
		if shown and not _both_empty(old, new):
			_add(lines, _(df.label), _show(old, df, before), _show(new, df, doc))

	for table, index, row_name, changes in diff.row_changed:
		if table in NOISE_TABLES:
			continue
		table_label = _(doc.meta.get_field(table).label)
		row = next((r for r in doc.get(table) if r.name == row_name), None)
		old_row = next((r for r in before.get(table) if r.name == row_name), None)
		if not (row and old_row):
			continue
		where = f"{table_label} row {index + 1}{_row_title(row, prefix=' – ')}"
		for field, old, new in changes:
			df = row.meta.get_field(field)
			if _is_shown(df) and not _both_empty(old, new):
				_add(lines, f"{_(df.label)} ({where})", _show(old, df, old_row), _show(new, df, row))

	for table, row in diff.added:
		if table in NOISE_TABLES:
			continue
		lines.append(_("{0}: added {1}").format(_(doc.meta.get_field(table).label), _row_title(row) or _("a row")))
	for table, row in diff.removed:
		if table in NOISE_TABLES:
			continue
		lines.append(_("{0}: removed {1}").format(_(doc.meta.get_field(table).label), _row_title(row) or _("a row")))

	return lines


def _is_shown(df):
	if not df or df.hidden or df.fieldtype in SKIP_FIELDTYPES:
		return False
	name = df.fieldname
	return name not in NOISE_FIELDS and not name.startswith("base_") and not name.endswith("_in_words")


def _add(lines, label, old, new):
	# "0" sent by a form vs 0 stored, 100 vs 100.0: the same to a reader
	if old != new:
		lines.append(f"{label}: {old} → {new}")


def _both_empty(old, new):
	"""0 → None and "" → None are not changes a person made."""
	return not old and not new


def _show(value, df, doc):
	if value in (None, ""):
		return _("(empty)")
	if df.fieldtype == "Check":
		return _("Yes") if cint(value) else _("No")
	from frappe.utils.formatters import format_value

	text = strip_html(cstr(format_value(value, df, doc))).strip()
	if len(text) > MAX_VALUE_LENGTH:
		text = text[: MAX_VALUE_LENGTH - 1] + "…"
	return text


def _row_title(row, prefix=""):
	"""What a child row is about, e.g. "ITEM-001 · 2 × 120.00" or an account name."""
	get = row.get
	title = get("item_code") or get("item_name") or get("account") or get("reference_name") or get("description")
	if not title:
		return ""
	title = strip_html(cstr(title))[:60]
	amount = get("amount") or get("allocated_amount") or get("tax_amount") or get("debit") or get("credit")
	if amount:
		title += f" ({frappe.format_value(flt(amount), 'Currency')})"
	return prefix + title
