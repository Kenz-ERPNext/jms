// Copyright (c) 2025, Your Company and contributors
// For license information, please see license.txt

// Keys must match the Job.status Select field options exactly (see
// job.json) — job.js keeps its own copy of this map for the single-Job
// form view's title indicator.
// window-scoped (not const): job.js declares this same map for the form
// view's title indicator, and desk navigates between list/form without a
// full page reload, so both scripts can share one JS global scope — a
// const here would throw "already declared" on the second script to load.
window.job_status_colors = {
	"Created": "blue",
	"In Progress": "orange",
	"Processing": "yellow",
	"Supervisor Approved": "cyan",
	"MD Approved": "light-blue",
	"Completed": "green",
	"Closed": "purple",
	"Rejected": "pink",
	"Cancelled": "red"
};

frappe.listview_settings['Job'] = {
	add_fields: ["status", "billing_status", "priority", "customer", "net_amount", "balance", "overdue_status"],

	get_indicator: function(doc) {
		// Status indicators with colors. Keys must match the Job.status
		// Select field options exactly (Title Case) — this previously used
		// stale ALL-CAPS keys that never matched a real status value, so
		// every job silently fell through to the same grey indicator.
		return [__(doc.status), job_status_colors[doc.status] || "gray", "status,=," + doc.status];
	},

	formatters: {
		status: function(value) {
			return `<span class="indicator-pill ${job_status_colors[value] || "gray"}">${__(value)}</span>`;
		},

		billing_status: function(value) {
			const billing_map = {
				"Not Billed": '<span class="indicator-pill grey">Not Billed</span>',
				"Partially Billed": '<span class="indicator-pill orange">Partially Billed</span>',
				"Fully Billed": '<span class="indicator-pill green">Fully Billed</span>'
			};
			return billing_map[value] || value;
		},

		priority: function(value) {
			const priority_map = {
				"Low": '<span class="indicator-pill blue">Low</span>',
				"Medium": '<span class="indicator-pill yellow">Medium</span>',
				"High": '<span class="indicator-pill orange">High</span>',
				"Urgent": '<span class="indicator-pill red">Urgent</span>'
			};
			return priority_map[value] || value;
		},

		overdue_status: function(value) {
			if (value === "Overdue") {
				return '<span class="indicator-pill red">Overdue</span>';
			} else if (value === "On Time") {
				return '<span class="indicator-pill green">On Time</span>';
			}
			return value || "";
		},

		balance: function(value, df, doc) {
			if (value > 0) {
				return `<span style="color: red; font-weight: bold;">${format_currency(value)}</span>`;
			} else if (value == 0) {
				return `<span style="color: green;">${format_currency(value)}</span>`;
			}
			return format_currency(value);
		}
	},

	onload: function(listview) {
		// Clear default 'In Progress' filter if applied by shortcut/route
		if (frappe.route_options && frappe.route_options.status) {
			delete frappe.route_options.status;
		}
		if (listview.filter_area) {
			listview.filter_area.remove("status");
		}

		// Add custom buttons to list view
		listview.page.add_inner_button(__('Create Sample Jobs'), function() {
			frappe.call({
				method: 'jms.jms.fixtures.sample_data.create_sample_jobs',
				callback: function(r) {
					listview.refresh();
					frappe.show_alert({
						message: __('Sample jobs created'),
						indicator: 'green'
					});
				}
			});
		});

		// Add filter shortcuts
		listview.page.add_menu_item(__('Show Only Processing'), function() {
			listview.filter_area.add([[listview.doctype, 'status', '=', 'Processing']]);
		});

		listview.page.add_menu_item(__('Show Only Overdue'), function() {
			listview.filter_area.add([[listview.doctype, 'overdue_status', '=', 'Overdue']]);
		});

		listview.page.add_menu_item(__('Show Unpaid'), function() {
			listview.filter_area.add([[listview.doctype, 'balance', '>', 0]]);
		});
	},

	// Disable delete for specific statuses
	can_delete: function(doc) {
		if (doc.status === "Completed" || doc.status === "Cancelled") {
			frappe.msgprint(__("Cannot delete {0} jobs", [doc.status]));
			return false;
		}
		return true;
	}
};
