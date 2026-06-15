# Copyright (c) 2026, Kenz and contributors
#
# TEMPORARY compatibility shim for a frappe <-> erpnext version skew.
#
# On some deployments erpnext is newer than frappe (e.g. erpnext 15.110 with
# frappe 15.93). The newer erpnext calls
#     Document.round_floats_in(item, do_not_round_fields=[...])
# but older frappe's round_floats_in(self, doc, fieldnames=None) does not accept
# that keyword, so every invoice calculation crashes with:
#     TypeError: round_floats_in() got an unexpected keyword argument
#                'do_not_round_fields'
#
# The real fix is to update frappe on that site to match erpnext. Until then,
# this shim makes the old method accept (and honour) `do_not_round_fields`.
# It is a NO-OP on any frappe build that already supports the argument, so it is
# safe to leave in and should be removed once versions are aligned.

import inspect

import frappe
from frappe.model.document import Document

_PATCHED = False


def patch_round_floats_in():
	global _PATCHED
	if _PATCHED:
		return

	try:
		params = inspect.signature(Document.round_floats_in).parameters
	except (ValueError, TypeError):
		params = {}

	if "do_not_round_fields" in params:
		# frappe already supports it natively — nothing to do.
		_PATCHED = True
		return

	_original = Document.round_floats_in

	def round_floats_in(self, doc, fieldnames=None, do_not_round_fields=None):
		if not fieldnames:
			fieldnames = [
				df.fieldname
				for df in doc.meta.get(
					"fields", {"fieldtype": ["in", ["Currency", "Float", "Percent"]]}
				)
			]
		if do_not_round_fields:
			skip = set(do_not_round_fields)
			fieldnames = [f for f in fieldnames if f not in skip]
		return _original(self, doc, fieldnames=fieldnames)

	Document.round_floats_in = round_floats_in
	_PATCHED = True
