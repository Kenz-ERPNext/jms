# Copyright (c) 2026, Kenz and contributors
# Repair out-of-sync naming-series counters.
#
# Symptom: creating a Purchase Invoice (Create Expense / Create Purchase
# Invoice) or Sales Invoice / Payment Entry fails with
#   DuplicateEntryError: Duplicate entry 'ACC-PINV-2026-0000X' for key 'PRIMARY'
# because `tabSeries.current` is BEHIND the highest document name that
# already exists (typically after a DB restore/import). The series then
# hands out names that already exist.
#
# Fix: for each document name, derive its (prefix, number); bump
# `tabSeries.current` up to the real max per prefix. Only ever increases
# the counter, never decreases it. Idempotent.

import re

import frappe

# Doctypes whose creation is triggered by Job buttons.
DOCTYPES = [
	"Sales Invoice",
	"Purchase Invoice",
	"Payment Entry",
	"Journal Entry",
]

_TRAILING_NUM = re.compile(r"^(.*?)(\d+)$")


def execute():
	for doctype in DOCTYPES:
		repair_doctype_series(doctype)
	frappe.db.commit()


def repair_doctype_series(doctype):
	names = frappe.db.get_all(doctype, pluck="name")
	max_by_prefix = {}
	for name in names:
		if not name:
			continue
		m = _TRAILING_NUM.match(name)
		if not m:
			continue
		prefix, num = m.group(1), int(m.group(2))
		if num > max_by_prefix.get(prefix, 0):
			max_by_prefix[prefix] = num

	for prefix, num in max_by_prefix.items():
		# Only repair series that already exist. We never CREATE a series row:
		# names like "SI-00025-1" are amendments and would otherwise produce a
		# bogus "SI-00025-" prefix. Real desync is an existing-but-behind row.
		current = frappe.db.sql(
			"SELECT `current` FROM `tabSeries` WHERE name=%s FOR UPDATE", prefix
		)
		if current and int(current[0][0] or 0) < num:
			frappe.db.sql(
				"UPDATE `tabSeries` SET `current`=%s WHERE name=%s", (num, prefix)
			)
			print(f"  series {prefix!r}: {current[0][0]} -> {num}")
