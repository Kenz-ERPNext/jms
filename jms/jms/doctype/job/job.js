// Copyright (c) 2025, Your Company and contributors
// For license information, please see license.txt
 
frappe.ui.form.on('Job', {

	onload(frm) {
		salesInvoiceMessage(frm);
    },

	refresh: function(frm) {

		salesInvoiceMessage(frm);

		frm.set_query("customer", function() {
            return {
                filters: {
                    custom_agent: 0,
					
                }
            };
        });



		// Add custom buttons
		// if (!frm.is_new()) {
		// 	frm.add_custom_button(__('Get Progress'), function() {
		// 		cur_frm.call({
        //             doc: cur_frm.doc,
		// 			method: "get_job_progress",
		// 			args: {
		// 				job_name: frm.doc.name
		// 			},
		// 			callback: function(r) {
		// 				if (r.message) {
		// 					frappe.msgprint({
		// 						title: __('Job Progress'),
		// 						message: `
		// 							<div style="padding: 10px;">
		// 								<p><strong>Progress:</strong> ${r.message.progress}%</p>
		// 								<p><strong>Total Tasks:</strong> ${r.message.total_tasks}</p>
		// 								<p><strong>Completed:</strong> ${r.message.completed_tasks}</p>
		// 								<p><strong>In Progress:</strong> ${r.message.in_progress_tasks}</p>
		// 								<p><strong>Pending:</strong> ${r.message.pending_tasks}</p>
		// 							</div>
		// 						`,
		// 						indicator: 'blue'
		// 					});
		// 				}
		// 			}
		// 		});
		// 	});

		// 	}




		if (frm.doc.sales_invoice_payment_entry === '' && frm.doc.sales_invoice_status === 'Created') {
            frm.add_custom_button(__('SI Payment'), function () {

                frappe.prompt(
                    [
                        {
							fieldname: "mode_of_payment",
							label: "Mode of Payment",
							fieldtype: "Link",
							options: "Mode of Payment",
							reqd: 1
						}
                    ],
                    function (data) {
                        cur_frm.call({
                            doc: cur_frm.doc,
                            method: "create_payment",
                            args: {
                                mode_of_payment: data.mode_of_payment
                            },
                            callback: function (r) {
                                if (r.message) {
                                    frappe.msgprint("Invoice Created: <b>" + r.message + "</b>");
                                }
                            }
                        });
                    },
                    __("Select Mode Of Payment"),
                    __("Create")
                );

            });
        }

		if (frm.doc.status === 'Completed' && frm.doc.sales_invoice_status !== 'Created') {
            frm.add_custom_button(__('Create Sales Invoice'), function () {

				if (!frm.doc.payment) {
					frappe.msgprint(__('Payment is required before creating Sales Invoice.'));
					return; // Stop execution
				}

                frappe.prompt(
                    [
                        {
                            fieldname: "tax_template",
                            label: "Sales Taxes and Charges Template",
                            fieldtype: "Link",
                            options: "Sales Taxes and Charges Template",
                            reqd: 1
                        }
                    ],
                    function (data) {
                        cur_frm.call({
                            doc: cur_frm.doc,
                            method: "create_invoice",
                            args: {
                                tax_template: data.tax_template
                            },
                            callback: function (r) {
                                if (r.message) {
                                    frappe.msgprint("Invoice Created: <b>" + r.message + "</b>");
                                }
                            }
                        });
                    },
                    __("Select Tax Template"),
                    __("Create")
                );

            });
        }

		// if (frm.doc.status === 'Completed' && frm.doc.purchase_invoice_status !== 'Created') {
        //     frm.add_custom_button(__('Create Purchase Invoice'), function () {
		// 		cur_frm.call({
        //             doc: cur_frm.doc,
        //             method: "create_pinvoice",
        //             args: {},
        //             callback: function (r) {
        //                 if (r.message) {
		// 					frappe.msgprint("Invoice Created: <b>" + r.message + "</b>");
        //                 }
        //             }
        //         });
        //     });

		let outsource_rows = frm.doc.tasks.filter(row => row.employee__outsource === "Outsource");

        // Only show button if there are outsource rows
        if (outsource_rows.length > 0 && frm.doc.status === 'Completed' && frm.doc.purchase_invoice_status !== 'Created') {
            frm.add_custom_button(__('Create Purchase Invoice'), function () {
                cur_frm.call({
                    doc: cur_frm.doc,
                    method: "create_pinvoice",
                    args: {},
                    callback: function (r) {
                        if (r.message) {
                            frappe.msgprint("Invoice Created: <b>" + r.message + "</b>");
                        }
                    }
                });
            });
        // }

		
        
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

		 set_job_status(frm);
	},

	employee__outsource: function(frm, cdt, cdn) {
        let row = locals[cdt][cdn];

        if (row.employee__outsource === "Employee") {
            // Clear outsource field
            frappe.model.set_value(cdt, cdn, 'outsource_supplier', "");
			frappe.model.set_value(cdt, cdn, 'assigned_tos', "");
            frm.refresh_field("job_task");   // refresh child table
        }

        if (row.employee__outsource === "Outsource") {
            // Clear employee field
            frappe.model.set_value(cdt, cdn, 'employee_user', "");
			frappe.model.set_value(cdt, cdn, 'assigned_to', "");
            frm.refresh_field("job_task");   // refresh child table
        }
    },
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


function set_job_status(frm) {
    if (!frm.doc.tasks || frm.doc.tasks.length === 0) return;

    let all_completed = frm.doc.tasks.every(row => row.status === "Completed");

    if (all_completed) {
        frm.set_value("status", "Completed");
		frm.set_value("completion_date", frappe.datetime.get_today());
    }

	let all_inp = frm.doc.tasks.every(row => row.status === "In Progress");

    if (all_inp) {
        frm.set_value("status", "In Progress");
    }


    frm.refresh_field("status");
}


function salesInvoiceMessage(frm) {
    console.log("DOCSTATUS:", frm.doc.docstatus);
    console.log("STATUS:", frm.doc.status);
    console.log("HTML FIELD EXISTS:", !!frm.fields_dict.message);

    if (!frm.fields_dict.message) {
        console.log("FIELD 'message' NOT FOUND!");
        return;
    }

    frm.fields_dict.message.$wrapper.html("");

    let html = "";

    if (frm.doc.status === "Completed" && frm.doc.sales_invoice_status === "") {
        html += `
            <div style="color: green; font-size: 13px; font-weight: bold;">
                Sales Invoice Creation is Pending ✨
            </div>
        `;
        console.log("SALES INVOICE MESSAGE SHOWN");
    }

	let outsource_rows = frm.doc.tasks.filter(row => row.employee__outsource === "Outsource");
    if (frm.doc.status === "Completed" && frm.doc.purchase_invoice_status === "" && outsource_rows.length > 0) {
		html += `
			<div style="color: green; font-size: 13px; font-weight: bold; margin-top: 5px;">
				Purchase Invoice Creation is Pending ✨
			</div>
		`;
		console.log("PURCHASE INVOICE MESSAGE SHOWN");
	}

    if (frm.doc.sales_invoice_status === "Created" && frm.doc.sales_invoice_payment_entry === "") {
        html += `
            <div style="color: #FF1717; font-size: 13px; font-weight: bold; margin-top: 5px;">
                Sales Invoice Payment Pending ✨
            </div>
        `;
        console.log("SALES INVOICE PAYMENT MESSAGE SHOWN");
    }

    if (!html) {
        console.log("NO CONDITIONS MATCHED");
        return;
    }

    frm.fields_dict.message.$wrapper.html(html);
}

