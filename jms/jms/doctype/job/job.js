// Copyright (c) 2025, Your Company and contributors
// For license information, please see license.txt

frappe.ui.form.on('Job', {
	refresh: function(frm) {
		// Add custom buttons
		if (!frm.is_new()) {
			frm.add_custom_button(__('Get Progress'), function() {
				frappe.call({
					method: 'jms.jms.doctype.job.job.get_job_progress',
					args: {
						job_name: frm.doc.name
					},
					callback: function(r) {
						if (r.message) {
							frappe.msgprint({
								title: __('Job Progress'),
								message: `
									<div style="padding: 10px;">
										<p><strong>Progress:</strong> ${r.message.progress}%</p>
										<p><strong>Total Tasks:</strong> ${r.message.total_tasks}</p>
										<p><strong>Completed:</strong> ${r.message.completed_tasks}</p>
										<p><strong>In Progress:</strong> ${r.message.in_progress_tasks}</p>
										<p><strong>Pending:</strong> ${r.message.pending_tasks}</p>
									</div>
								`,
								indicator: 'blue'
							});
						}
					}
				});
			});

			// Add button to create invoice if not billed
			if (frm.doc.billing_status != 'Fully Billed' && frm.doc.net_amount > 0) {
				frm.add_custom_button(__('Create Invoice'), function() {
					frappe.model.open_mapped_doc({
						method: 'jms.jms.doctype.job.job.make_sales_invoice',
						frm: frm
					});
				}, __('Create'));
			}
		}

		// Set filter for job nature based on job type
		frm.set_query('job_nature', function() {
			if (frm.doc.job_type) {
				return {
					filters: {
						job_type: frm.doc.job_type
					}
				};
			}
		});

		// Show agent field only if job source requires it
		if (frm.doc.job_source) {
			frappe.db.get_value('Job Source', frm.doc.job_source, 'is_agent_required', function(r) {
				if (r && r.is_agent_required) {
					frm.set_df_property('agent', 'reqd', 1);
				} else {
					frm.set_df_property('agent', 'reqd', 0);
				}
			});
		}

		// Toggle customer/agent fields based on create_customer_from_agent
		frm.trigger('toggle_customer_agent_fields');
	},

	job_type: function(frm) {
		// Clear job nature when job type changes
		frm.set_value('job_nature', '');

		// Set expected completion date based on job type
		if (frm.doc.job_type && frm.doc.start_date && !frm.doc.expected_completion_date) {
			frappe.db.get_value('Job Type', frm.doc.job_type, 'default_duration_days', function(r) {
				if (r && r.default_duration_days) {
					let expected_date = frappe.datetime.add_days(frm.doc.start_date, r.default_duration_days);
					frm.set_value('expected_completion_date', expected_date);
				}
			});
		}
	},

	agent: function(frm) {
		// Calculate agent commission
		if (frm.doc.agent && frm.doc.net_amount) {
			frappe.db.get_value('Agent', frm.doc.agent, ['commission_type', 'commission_rate'], function(r) {
				if (r) {
					let commission = 0;
					if (r.commission_type === 'Percentage') {
						commission = (frm.doc.net_amount * r.commission_rate) / 100;
					} else if (r.commission_type === 'Fixed Amount') {
						commission = r.commission_rate;
					}
					frm.set_value('agent_commission', commission);
				}
			});
		}
	},

	create_customer_from_agent: function(frm) {
		frm.trigger('toggle_customer_agent_fields');
	},

	toggle_customer_agent_fields: function(frm) {
		if (frm.doc.create_customer_from_agent) {
			frm.set_df_property('customer', 'reqd', 0);
			frm.set_df_property('agent', 'reqd', 1);
			frm.set_df_property('customer', 'read_only', 1);
		} else {
			frm.set_df_property('customer', 'reqd', 1);
			frm.set_df_property('agent', 'reqd', 0);
			frm.set_df_property('customer', 'read_only', 0);
		}
	},

	job_source: function(frm) {
		// Check if agent is required
		if (frm.doc.job_source) {
			frappe.db.get_value('Job Source', frm.doc.job_source, 'is_agent_required', function(r) {
				if (r && r.is_agent_required) {
					frm.set_df_property('agent', 'reqd', 1);
				} else {
					frm.set_df_property('agent', 'reqd', 0);
				}
			});
		}
	},

	discount: function(frm) {
		frm.trigger('calculate_totals');
	},

	vat: function(frm) {
		frm.trigger('calculate_totals');
	},

	paid_up: function(frm) {
		frm.trigger('calculate_balance');
	},

	calculate_totals: function(frm) {
		// This will be calculated on server side, just refresh
		frm.save();
	},

	calculate_balance: function(frm) {
		if (frm.doc.net_amount && frm.doc.paid_up) {
			frm.set_value('balance', frm.doc.net_amount - frm.doc.paid_up);
		}
	}
});

// Child table event for Job Task
frappe.ui.form.on('Job Task', {
	status: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];

		// Auto-set completion date when task is marked as completed
		if (row.status === 'Completed' && !row.completion_date) {
			frappe.model.set_value(cdt, cdn, 'completion_date', frappe.datetime.get_today());
		}
	}
});

// Child table event for Job Item
frappe.ui.form.on('Job Item', {
	work_template: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];

		// Fetch work template details
		if (row.work_template) {
			frappe.db.get_doc('Work Template', row.work_template).then(doc => {
				frappe.model.set_value(cdt, cdn, 'description', doc.description);
				frappe.model.set_value(cdt, cdn, 'job_qty', doc.job_qty);
				frappe.model.set_value(cdt, cdn, 'fee_price', doc.fee_price);
				frappe.model.set_value(cdt, cdn, 'extra', doc.extra);
				frappe.model.set_value(cdt, cdn, 'surcharge', doc.surcharge);
				frappe.model.set_value(cdt, cdn, 'vat', doc.vat);

				// Calculate item total
				frm.trigger('calculate_item_total', cdt, cdn);
			});
		}
	},

	job_qty: function(frm, cdt, cdn) {
		frm.trigger('calculate_item_total', cdt, cdn);
	},

	fee_price: function(frm, cdt, cdn) {
		frm.trigger('calculate_item_total', cdt, cdn);
	},

	extra: function(frm, cdt, cdn) {
		frm.trigger('calculate_item_total', cdt, cdn);
	},

	surcharge: function(frm, cdt, cdn) {
		frm.trigger('calculate_item_total', cdt, cdn);
	},

	vat: function(frm, cdt, cdn) {
		frm.trigger('calculate_item_total', cdt, cdn);
	},

	items_remove: function(frm) {
		frm.trigger('calculate_totals');
	},

	calculate_item_total: function(frm, cdt, cdn) {
		let row = locals[cdt][cdn];

		// Calculate item total
		let item_total = (row.fee_price || 0) * (row.job_qty || 1);
		item_total += (row.extra || 0) + (row.surcharge || 0);

		// Apply VAT to item
		if (row.vat) {
			let vat_amount = item_total * (row.vat / 100);
			item_total += vat_amount;
		}

		frappe.model.set_value(cdt, cdn, 'cost', item_total);
		frappe.model.set_value(cdt, cdn, 'total', item_total);

		// Refresh totals
		setTimeout(() => frm.save(), 500);
	}
});
