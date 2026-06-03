# Copyright (c) 2026, Kenz and contributors
# Dashboard Chart Source records are not picked up by sync_dashboards()
# during migrate, so import the Job Profitability Trend source explicitly.
# Idempotent — import_file_by_path overwrites.

import os

import frappe
from frappe.modules.import_file import import_file_by_path


def execute():
	path = frappe.get_app_path(
		"jms",
		"jms",
		"dashboard_chart_source",
		"job_profitability_trend",
		"job_profitability_trend.json",
	)
	if os.path.exists(path):
		import_file_by_path(path)
