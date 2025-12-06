// Copyright (c) 2025, Your Company and contributors
// For license information, please see license.txt

frappe.listview_settings['Job'] = {
	add_fields: ["status", "billing_status", "priority", "customer", "net_amount", "balance", "overdue_status"],

	get_indicator: function(doc) {
		// Status indicators with colors
		const status_colors = {
			"CREATED": "blue",
			"PROCESSING": "orange",
			"COMPLETED": "green",
			"REJECTED": "red",
			"CANCELED": "darkgrey",
			"PENDING_EXT(COMPLETED)": "purple",
			"AMT_PENDING(COMPLETED)": "yellow"
		};

		return [__(doc.status), status_colors[doc.status] || "gray", "status,=," + doc.status];
	},

	formatters: {
		status: function(value) {
			const status_map = {
				"CREATED": '<span class="indicator-pill blue">CREATED</span>',
				"PROCESSING": '<span class="indicator-pill orange">PROCESSING</span>',
				"COMPLETED": '<span class="indicator-pill green">COMPLETED</span>',
				"REJECTED": '<span class="indicator-pill red">REJECTED</span>',
				"CANCELED": '<span class="indicator-pill darkgrey">CANCELED</span>',
				"PENDING_EXT(COMPLETED)": '<span class="indicator-pill purple">PENDING EXT</span>',
				"AMT_PENDING(COMPLETED)": '<span class="indicator-pill yellow">AMT PENDING</span>'
			};
			return status_map[value] || value;
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
			listview.filter_area.add([[listview.doctype, 'status', '=', 'PROCESSING']]);
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
		if (doc.status === "COMPLETED" || doc.status === "CANCELED") {
			frappe.msgprint(__("Cannot delete {0} jobs", [doc.status]));
			return false;
		}
		return true;
	}
};
