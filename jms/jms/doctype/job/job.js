// Copyright (c) 2025, Your Company and contributors
// For license information, please see license.txt
 
frappe.ui.form.on('Job', {

	// NOTE: payment / mode_of_payment (and the _pi variants) are no longer
	// auto-saved on change — that caused the form to save and jump to the top
	// while selecting. These values are now chosen inside each creation dialog
	// and passed straight to the server method.

	onload(frm) {
		salesInvoiceMessage(frm);

        if (!frm.doc.company) {

            frappe.call({
                method: "frappe.client.get_value",
                args: {
                    doctype: "Global Defaults",
                    fieldname: "default_company"
                },
                callback: function(r) {
                    if (r.message && r.message.default_company) {
                        frm.set_value("company", r.message.default_company);
                    }
                }
            });

        }

    },

	refresh: function(frm) {
        // frappe.msgprint("hi")


		salesInvoiceMessage(frm);

		renderJobFinancials(frm);

		// Group all action buttons under a single "Create" dropdown
		const addCreate = (label, action) => frm.add_custom_button(__(label), action, __('Create'));

		// --------------------------------------------------
		// CLOSE JOB (Status is read-only / auto-managed, so closing is an
		// explicit action). The strict rule is enforced server-side in
		// Job.validate_closing(): all tasks Completed AND full amount received.
		// --------------------------------------------------
		if (!frm.is_new() && !["Closed", "Cancelled", "Rejected"].includes(frm.doc.status)) {
			frm.add_custom_button(__("Close Job"), function () {
				frappe.confirm(
					__("Close this Job? All tasks must be Completed and the full amount received."),
					function () {
						frm.set_value("status", "Closed");
						frm.save().then(() => {
							frappe.show_alert({ message: __("Job Closed"), indicator: "green" });
						}).catch(() => {
							// blocked by validate_closing — revert the in-memory status
							frm.reload_doc();
						});
					}
				);
			}).addClass("btn-primary");
		}

		frm.set_query("customer", function() {
            return {
                filters: {
                    custom_agent: 0,
					
                }
            };
        });



        // --------------------------------------------------
        // OUTSOURCE ADVANCE PAYMENT
        // --------------------------------------------------

        let outsource_advance_rows = frm.doc.tasks.filter(
            row =>
                row.employee__outsource === "Outsource"
                && row.outsource_supplier
        );

        if (outsource_advance_rows.length > 0) {

            addCreate('Outsource Advance Payment', function () {

                // -----------------------------------------
                // UNIQUE SUPPLIERS
                // -----------------------------------------

                let supplier_map = {};

                outsource_advance_rows.forEach(row => {

                    if (!supplier_map[row.outsource_supplier]) {

                        supplier_map[row.outsource_supplier] = {
                            supplier: row.outsource_supplier
                        };
                    }
                });

                let table_data = [];

                Object.keys(supplier_map).forEach(key => {

                    table_data.push({
                        supplier: key,
                        advance_amount: 0
                    });

                });

                // open Purchase Invoices for this job, grouped by supplier,
                // used to auto-allocate each supplier's advance (FIFO).
                let openPIsBySupplier = {};

                // -----------------------------------------
                // DIALOG
                // -----------------------------------------

                let d = new frappe.ui.Dialog({

                    title: "Create Outsource Advance Payment",

                    fields: [

                        {
                            fieldname: "mode_of_payment",
                            label: "Mode of Payment",
                            fieldtype: "Link",
                            options: "Mode of Payment",
                            reqd: 1,
                            onchange: function () {

                                let mode_of_payment = d.get_value("mode_of_payment");

                                if (!mode_of_payment) {
                                    return;
                                }

                                frappe.db.get_value(
                                    "Mode of Payment",
                                    mode_of_payment,
                                    "type"
                                ).then(r => {

                                    let payment_type = r.message.type;

                                    if (payment_type === "Bank") {

                                        d.set_df_property(
                                            "reference_no",
                                            "hidden",
                                            0
                                        );

                                        d.set_df_property(
                                            "reference_date",
                                            "hidden",
                                            0
                                        );

                                    } else {

                                        d.set_df_property(
                                            "reference_no",
                                            "hidden",
                                            1
                                        );

                                        d.set_df_property(
                                            "reference_date",
                                            "hidden",
                                            1
                                        );

                                        d.set_value("reference_no", "");

                                        d.set_value("reference_date", "");
                                    }

                                    d.refresh();
                                });
                            }
                        },

                        {
                            fieldname: "reference_no",
                            label: "Reference No",
                            fieldtype: "Data",
                            hidden: 1
                        },

                        {
                            fieldname: "reference_date",
                            label: "Reference Date",
                            fieldtype: "Date",
                            hidden: 1
                        },

                        {
                            fieldname: "posting_date",
                            label: "Posting Date",
                            fieldtype: "Date",
                            default: frappe.datetime.get_today(),
                            reqd: 1
                        },

                        {
                            fieldname: "suppliers",
                            label: "Supplier Details",
                            fieldtype: "Table",
                            cannot_add_rows: true,
                            in_place_edit: true,
                            data: table_data,

                            fields: [

                                {
                                    fieldname: "supplier",
                                    label: "Supplier",
                                    fieldtype: "Link",
                                    options: "Supplier",
                                    in_list_view: 1,
                                    read_only: 1
                                },

                                {
                                    fieldname: "advance_amount",
                                    label: "Advance Amount",
                                    fieldtype: "Currency",
                                    in_list_view: 1,
                                    reqd: 1
                                }

                            ]
                        }

                    ],

                    primary_action_label: "Create",

                    primary_action(values) {

                        let valid_rows = values.suppliers.filter(
                            row => flt(row.advance_amount) > 0
                        );

                        if (!valid_rows.length) {

                            frappe.msgprint(
                                __("Please enter at least one advance amount")
                            );

                            return;
                        }

                        // Auto-allocate each supplier's advance FIFO across that
                        // supplier's open Purchase Invoices; remainder stays advance.
                        valid_rows.forEach(row => {
                            let remaining = flt(row.advance_amount);
                            row.allocations = [];
                            (openPIsBySupplier[row.supplier] || []).forEach(pi => {
                                if (remaining <= 0) return;
                                const alloc = Math.min(flt(pi.outstanding_amount), remaining);
                                if (alloc > 0) {
                                    row.allocations.push({ invoice: pi.name, allocated_amount: alloc });
                                    remaining = flt(remaining - alloc);
                                }
                            });
                        });

                        frappe.call({

                            doc: frm.doc,

                            method: "create_outsource_advance_payment",

                            args: {
                                suppliers: valid_rows,
                                mode_of_payment: values.mode_of_payment,
                                reference_no: values.reference_no,
                                reference_date: values.reference_date,
                                posting_date: values.posting_date
                            },

                            callback: function(r) {

                                if (r.message) {

                                    frappe.msgprint({
                                        title: __("Success"),
                                        message:
                                            __("Payment Entries Created:<br>")
                                            + r.message.join("<br>"),
                                        indicator: "green"
                                    });

                                    frm.reload_doc();

                                    d.hide();
                                }
                            }
                        });
                    }
                });

                d.show();

                frappe.call({
                    doc: frm.doc,
                    method: "get_job_open_invoices",
                    args: { invoice_type: "Purchase Invoice" },
                    callback: function (r) {
                        openPIsBySupplier = {};
                        (r.message || []).forEach(pi => {
                            (openPIsBySupplier[pi.party] = openPIsBySupplier[pi.party] || []).push(pi);
                        });
                    }
                });

            });
        }


//////////////////////////////////////////////////////////////
// //////////////////////////////////////////////////////////




        addCreate('Advance Receipt', function () {

        let d = new frappe.ui.Dialog({

            title: "Create Advance Receipt",

            fields: [

                {
                    fieldname: "advance_amount",
                    label: "Advance Amount",
                    fieldtype: "Currency",
                    reqd: 1,
                    onchange: function () {
                        jmsAutofillAllocation(d, "allocation_html", () => d.get_value("advance_amount"));
                    }
                },

                {
                    fieldname: "mode_of_payment",
                    label: "Mode of Payment",
                    fieldtype: "Link",
                    options: "Mode of Payment",
                    reqd: 1,

                    onchange: function () {

                        let mode_of_payment = d.get_value("mode_of_payment");

                        if (!mode_of_payment) {
                            return;
                        }

                        frappe.db.get_value(
                            "Mode of Payment",
                            mode_of_payment,
                            "type"
                        ).then(r => {

                            let payment_type = r.message.type;

                            if (payment_type === "Bank") {

                                d.set_df_property(
                                    "reference_no",
                                    "hidden",
                                    0
                                );

                                d.set_df_property(
                                    "reference_date",
                                    "hidden",
                                    0
                                );

                            } else {

                                d.set_df_property(
                                    "reference_no",
                                    "hidden",
                                    1
                                );

                                d.set_df_property(
                                    "reference_date",
                                    "hidden",
                                    1
                                );

                                d.set_value("reference_no", "");

                                d.set_value("reference_date", "");
                            }

                            d.refresh();
                        });
                    }
                },

                {
                    fieldname: "reference_no",
                    label: "Reference No",
                    fieldtype: "Data",
                    hidden: 1
                },

                {
                    fieldname: "reference_date",
                    label: "Reference Date",
                    fieldtype: "Date",
                    hidden: 1
                },

                {
                    fieldname: "posting_date",
                    label: "Posting Date",
                    fieldtype: "Date",
                    default: frappe.datetime.get_today(),
                    reqd: 1
                },

                {
                    fieldname: "alloc_sb",
                    fieldtype: "Section Break",
                    label: "Allocate to Open Sales Invoices (optional)"
                },
                {
                    fieldname: "allocation_html",
                    fieldtype: "HTML"
                }

            ],

            primary_action_label: "Create",

            primary_action(values) {

                const allocations = jmsCollectAllocations(d, "allocation_html")
                    .map(a => ({ invoice: a.key, allocated_amount: a.allocated_amount }));

                frappe.call({
                    doc: frm.doc,
                    method: "create_advance_receipt",
                    args: {
                        amount: values.advance_amount,
                        mode_of_payment: values.mode_of_payment,
                        reference_no: values.reference_no,
                        reference_date: values.reference_date,
                        allocations: allocations,
                        posting_date: values.posting_date
                    },
                    callback: function(r) {

                        if (r.message) {

                            frappe.msgprint(
                                __("Advance Payment Entry Created: " + r.message)
                            );

                            frm.reload_doc();

                            d.hide();
                        }
                    }
                });

            }

        });

        d.show();

        frappe.call({
            doc: frm.doc,
            method: "get_job_open_invoices",
            args: { invoice_type: "Sales Invoice" },
            callback: function (r) {
                const items = (r.message || []).map(o => ({
                    key: o.name, outstanding: o.outstanding_amount
                }));
                jmsRenderAllocation(d, "allocation_html", items,
                    () => d.get_value("advance_amount"),
                    { key_label: "Sales Invoice", empty: "sales invoices" });
            }
        });

    });


// ////////////////////////////////////////////////////////////////////////////////////
// //////////////////////////////////////////////////////////////////////////////////////


		if (frm.doc.sales_invoice_payment_entry === '' 
            // &&frm.doc.sales_invoice_status === 'Created'
        ) {
            addCreate('SI Payment', function () {

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


////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////


        // frm.add_custom_button(__('Create Sales Invoice'), function () {

        //     if (!frm.doc.payment) {
        //         frappe.msgprint(__('Payment is required before creating Sales Invoice.'));
        //         return;
        //     }

        //     if (frm.doc.sales_invoice_status === 'Created') {
        //         frappe.msgprint(__('Sales Invoice already created for this Job.'));
        //         return;
        //     }

        //     // ----------------------------
        //     // Calculate Total Invoice Amount
        //     // ----------------------------
        //     let total_amount = 0;

        //     if (frm.doc.items) {
        //         frm.doc.items.forEach(row => {
        //             total_amount += flt(row.total_without_tax || 0);
        //         });
        //     }

        //     // ----------------------------
        //     // Dynamic Fields
        //     // ----------------------------
        //     let fields = [
        //         {
        //             fieldname: "tax_template",
        //             label: "Sales Taxes and Charges Template",
        //             fieldtype: "Link",
        //             options: "Sales Taxes and Charges Template",
        //             reqd: 1
        //         },
        //         {
        //             fieldname: "invoice_total",
        //             label: "Total Invoice Amount",
        //             fieldtype: "Currency",
        //             default: total_amount,
        //             read_only: 1
        //         }
        //     ];

        //     // 👉 Only add payment fields if NOT Credit
        //     if (frm.doc.payment !== "Credit") {
        //         fields.push(
        //             {
        //                 fieldname: "payment_type",
        //                 label: "Payment Type",
        //                 fieldtype: "Select",
        //                 options: "Full Paid\nPartially Paid",
        //                 reqd: 1
        //             },
        //             {
        //                 fieldname: "partial_amount",
        //                 label: "Partial Amount",
        //                 fieldtype: "Currency",
        //                 depends_on: "eval:doc.payment_type=='Partially Paid'"
        //             }
        //         );
        //     }

        //     // ----------------------------
        //     // Popup
        //     // ----------------------------
        //     frappe.prompt(
        //         fields,
        //         function (data) {

        //             // Validation only for non-credit
        //             if (frm.doc.payment !== "Credit") {

        //                 if (data.payment_type === "Partially Paid" && !data.partial_amount) {
        //                     frappe.msgprint("Please enter Partial Amount");
        //                     return;
        //                 }

        //                 if (data.payment_type === "Partially Paid" && data.partial_amount > data.invoice_total) {
        //                     frappe.msgprint("Partial amount cannot exceed Invoice Total");
        //                     return;
        //                 }
        //             }

        //             cur_frm.call({
        //                 doc: cur_frm.doc,
        //                 method: "create_invoice",
        //                 args: {
        //                     tax_template: data.tax_template,
        //                     payment_type: data.payment_type || "Credit",
        //                     partial_amount: data.partial_amount || 0
        //                 },
        //                 callback: function (r) {
        //                     if (r.message) {
        //                         frappe.msgprint("Process Completed: <b>" + r.message + "</b>");
        //                     }
        //                 }
        //             });
        //         },
        //         __("Create Invoice & Payment"),
        //         __("Submit")
        //     );

        // });


        addCreate('Create Sales Invoice', function () {

            // Block ONLY if an active (submitted) Sales Invoice still exists.
            // A cancelled invoice (docstatus=2) frees the Job to create a new
            // one — checked live so a cancellation elsewhere is reflected even
            // if the open form's cached sales_invoice_status is stale.
            frappe.db.count("Sales Invoice", { filters: { job: frm.doc.name, docstatus: 1 } }).then(active_si => {

            if (active_si > 0) {

                frappe.msgprint(
                    __('Sales Invoice already created for this Job.')
                );

                return;
            }

            // ----------------------------
            // Calculate Total Invoice Amount
            // ----------------------------

            let total_amount = 0;

            if (frm.doc.items) {

                frm.doc.items.forEach(row => {

                    total_amount += flt(row.total_without_tax || 0);

                });
            }

            // ----------------------------
            // Dynamic Fields
            // ----------------------------

            let fields = [

                {
                    fieldname: "posting_date",
                    label: "Posting Date",
                    fieldtype: "Date",
                    default: frappe.datetime.get_today(),
                    reqd: 1
                },

                {
                    fieldname: "tax_template",
                    label: "Sales Taxes and Charges Template",
                    fieldtype: "Link",
                    options: "Sales Taxes and Charges Template",
                    reqd: 1
                },

                {
                    fieldname: "invoice_total",
                    label: "Total Invoice Amount",
                    fieldtype: "Currency",
                    default: total_amount,
                    read_only: 1
                },

                {
                    fieldname: "payment",
                    label: "Payment",
                    fieldtype: "Select",
                    options: "Credit\nPayment Now",
                    default: frm.doc.payment || "Credit",
                    reqd: 1
                },

                {
                    fieldname: "mode_of_payment",
                    label: "Mode of Payment",
                    fieldtype: "Link",
                    options: "Mode of Payment",
                    default: frm.doc.mode_of_payment,
                    depends_on: "eval:doc.payment=='Payment Now'",
                    mandatory_depends_on: "eval:doc.payment=='Payment Now'",
                    change() {
                        jmsToggleReferenceFields(d, "mode_of_payment");
                    }
                },

                {
                    fieldname: "payment_type",
                    label: "Payment Type",
                    fieldtype: "Select",
                    options: "Full Paid\nPartially Paid",
                    depends_on: "eval:doc.payment=='Payment Now'",
                    mandatory_depends_on: "eval:doc.payment=='Payment Now'"
                },

                {
                    fieldname: "partial_amount",
                    label: "Partial Amount",
                    fieldtype: "Currency",
                    depends_on: "eval:doc.payment=='Payment Now' && doc.payment_type=='Partially Paid'"
                },

                {
                    fieldname: "reference_no",
                    label: "Reference No",
                    fieldtype: "Data",
                    hidden: 1
                },

                {
                    fieldname: "reference_date",
                    label: "Reference Date",
                    fieldtype: "Date",
                    hidden: 1
                },

                {
                    fieldname: "advances_sb",
                    fieldtype: "Section Break",
                    label: "Customer Advances"
                },
                {
                    fieldname: "advances_html",
                    fieldtype: "HTML"
                }

            ];

            // ----------------------------
            // Popup
            // ----------------------------

            let d = new frappe.ui.Dialog({

                title: __("Create Invoice & Payment"),

                fields: fields,

                primary_action_label: __("Submit"),

                primary_action(values) {

                    let isNow = values.payment === "Payment Now";

                    // -----------------------------------
                    // PAYMENT-NOW VALIDATION
                    // -----------------------------------

                    if (isNow) {

                        if (!values.mode_of_payment) {
                            frappe.msgprint(__("Please select Mode of Payment"));
                            return;
                        }

                        if (!values.payment_type) {
                            frappe.msgprint(__("Please select Payment Type"));
                            return;
                        }

                        if (
                            values.payment_type === "Partially Paid"
                            && !values.partial_amount
                        ) {
                            frappe.msgprint("Please enter Partial Amount");
                            return;
                        }

                        if (
                            values.payment_type === "Partially Paid"
                            && values.partial_amount > values.invoice_total
                        ) {
                            frappe.msgprint("Partial amount cannot exceed Invoice Total");
                            return;
                        }
                    }

                    let submit = function () {

                        cur_frm.call({

                            doc: cur_frm.doc,

                            method: "create_invoice",

                            args: {
                                tax_template: values.tax_template,
                                posting_date: values.posting_date,
                                payment: values.payment,
                                mode_of_payment: isNow ? values.mode_of_payment : null,
                                payment_type: isNow ? (values.payment_type || "Full Paid") : "Credit",
                                partial_amount: values.partial_amount || 0,
                                reference_no: values.reference_no,
                                reference_date: values.reference_date
                            },

                            callback: function (r) {
                                if (r.message) {
                                    frappe.msgprint(
                                        "Sales Invoice Created: <b>" + r.message + "</b>"
                                    );
                                    frm.reload_doc();
                                    d.hide();
                                }
                            }
                        });
                    };

                    // Bank mode requires reference no/date before submitting
                    if (isNow && values.mode_of_payment) {

                        frappe.db.get_value(
                            "Mode of Payment",
                            values.mode_of_payment,
                            "type"
                        ).then(r => {

                            if (r.message && r.message.type === "Bank") {

                                if (!values.reference_no) {
                                    frappe.msgprint("Reference No is required");
                                    return;
                                }

                                if (!values.reference_date) {
                                    frappe.msgprint("Reference Date is required");
                                    return;
                                }
                            }

                            submit();
                        });

                    } else {
                        submit();
                    }
                }

            });

            d.show();

            frappe.call({
                doc: frm.doc,
                method: "get_job_unallocated_payments",
                args: { payment_type: "Receive" },
                callback: function (r) {
                    jmsRenderAdvancesInfo(d, "advances_html", r.message || []);
                }
            });

            });  // end frappe.db.count(...).then

        });





//////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////



// {
//     frm.add_custom_button(__('Create Expense'), function () {

//         let d = new frappe.ui.Dialog({
//             title: 'Create Expense',
//             fields: [
//                 {
//                     label: 'Expense Type',
//                     fieldname: 'expense_type',
//                     fieldtype: 'Link',
//                     options: 'Expense Type',
//                     reqd: 1,
//                     change() {
//                         let expense_type = d.get_value('expense_type');

//                         if (expense_type) {
//                             frappe.db.get_value(
//                                 'Expense Type',
//                                 expense_type,
//                                 'item',
//                                 (r) => {
//                                     if (r && r.item) {
//                                         d.set_value('item_code', r.item);
//                                     } else {
//                                         frappe.msgprint(__('Item not set in Expense Type'));
//                                         d.set_value('item_code', null);
//                                     }
//                                 }
//                             );
//                         }
//                     }
//                 },
//                 {
//                     label: 'Amount',
//                     fieldname: 'amount',
//                     fieldtype: 'Currency',
//                     reqd: 1
//                 },
//                 {
//                     label: 'Supplier',
//                     fieldname: 'supplier',
//                     fieldtype: 'Link',
//                     options: 'Supplier',
//                     reqd: 1
//                 },
//                 {
//                     label: 'Payment Type',
//                     fieldname: 'payment_type',
//                     fieldtype: 'Select',
//                     options: 'Payment Now\nCredit',
//                     reqd: 1,
//                     change() {
//                         let pt = d.get_value('payment_type');

//                         if (pt === 'Payment Now') {
//                             d.set_df_property('mode_of_payment', 'hidden', 0);
//                         } else {
//                             d.set_df_property('mode_of_payment', 'hidden', 1);
//                             d.set_value('mode_of_payment', null);
//                         }
//                     }
//                 }, 
//                 {
//                     label: 'Mode of Payment',
//                     fieldname: 'mode_of_payment',
//                     fieldtype: 'Link',
//                     options: 'Mode of Payment',
//                     hidden: 1
//                 },
//                 {
//                     label: 'Purchase Taxes and Charges Template',
//                     fieldname: 'taxes_template',
//                     fieldtype: 'Link',
//                     options: 'Purchase Taxes and Charges Template'
//                 },
//                 {
//                     fieldname: 'item_code',
//                     fieldtype: 'Link',
//                     options: 'Item',
//                     hidden: 1
//                 }
//             ],

//             primary_action_label: 'Submit',
//             primary_action(values) {

//                 if (!values.item_code) {
//                     frappe.msgprint(__('Item not found for selected Expense Type'));
//                     return;
//                 }

//                 if (values.payment_type === "Payment Now" && !values.mode_of_payment) {
//                     frappe.msgprint(__('Mode of Payment is required for Payment Now'));
//                     return;
//                 }

//                 cur_frm.call({
//                     doc: cur_frm.doc,
//                     method: "create_expense",
//                     args: {
//                         expense_type: values.expense_type,
//                         amount: values.amount,
//                         supplier: values.supplier,
//                         taxes_template: values.taxes_template,
//                         item_code: values.item_code,
//                         payment_type: values.payment_type,
//                         mode_of_payment: values.mode_of_payment,
//                         reference_doctype: frm.doc.doctype,
//                         reference_name: frm.doc.name
//                     },
//                     callback: function(r) {
//                         if (!r.exc) {
//                             frappe.msgprint(__('Expense Invoice Created: {0}', [r.message]));
//                             d.hide();
//                             frm.reload_doc();
//                         }
//                     }
//                 });
//             }
//         });

//         d.show();
//     });
// }


{
    addCreate('Create Expense', function () {

        let d = new frappe.ui.Dialog({

            title: 'Create Expense',

            fields: [

                {
                    label: 'Expense Type',
                    fieldname: 'expense_type',
                    fieldtype: 'Link',
                    options: 'Expense Type',
                    reqd: 1,

                    change() {

                        let expense_type = d.get_value(
                            'expense_type'
                        );

                        if (expense_type) {

                            frappe.db.get_value(
                                'Expense Type',
                                expense_type,
                                'item',
                                (r) => {

                                    if (r && r.item) {

                                        d.set_value(
                                            'item_code',
                                            r.item
                                        );

                                    } else {

                                        frappe.msgprint(
                                            __('Item not set in Expense Type')
                                        );

                                        d.set_value(
                                            'item_code',
                                            null
                                        );
                                    }
                                }
                            );
                        }
                    }
                },

                {
                    label: 'Amount',
                    fieldname: 'amount',
                    fieldtype: 'Currency',
                    reqd: 1
                },

                {
                    label: 'Supplier',
                    fieldname: 'supplier',
                    fieldtype: 'Link',
                    options: 'Supplier',
                    reqd: 1
                },

                {
                    label: 'Payment Type',
                    fieldname: 'payment_type',
                    fieldtype: 'Select',
                    options: 'Payment Now\nCredit',
                    reqd: 1,

                    change() {

                        let pt = d.get_value(
                            'payment_type'
                        );

                        if (pt === 'Payment Now') {

                            d.set_df_property(
                                'mode_of_payment',
                                'hidden',
                                0
                            );

                        } else {

                            d.set_df_property(
                                'mode_of_payment',
                                'hidden',
                                1
                            );

                            d.set_df_property(
                                'reference_no',
                                'hidden',
                                1
                            );

                            d.set_df_property(
                                'reference_date',
                                'hidden',
                                1
                            );

                            d.set_value(
                                'mode_of_payment',
                                null
                            );

                            d.set_value(
                                'reference_no',
                                null
                            );

                            d.set_value(
                                'reference_date',
                                null
                            );
                        }
                    }
                },

                {
                    label: 'Mode of Payment',
                    fieldname: 'mode_of_payment',
                    fieldtype: 'Link',
                    options: 'Mode of Payment',
                    hidden: 1,

                    change() {

                        let mop = d.get_value(
                            'mode_of_payment'
                        );

                        if (!mop) {
                            return;
                        }

                        frappe.db.get_value(
                            "Mode of Payment",
                            mop,
                            "type"
                        ).then(r => {

                            let mop_type = r.message.type;

                            if (mop_type === "Bank") {

                                d.set_df_property(
                                    'reference_no',
                                    'hidden',
                                    0
                                );

                                d.set_df_property(
                                    'reference_date',
                                    'hidden',
                                    0
                                );

                            } else {

                                d.set_df_property(
                                    'reference_no',
                                    'hidden',
                                    1
                                );

                                d.set_df_property(
                                    'reference_date',
                                    'hidden',
                                    1
                                );

                                d.set_value(
                                    'reference_no',
                                    null
                                );

                                d.set_value(
                                    'reference_date',
                                    null
                                );
                            }

                            d.refresh();
                        });
                    }
                },

                {
                    label: 'Reference No',
                    fieldname: 'reference_no',
                    fieldtype: 'Data',
                    hidden: 1
                },

                {
                    label: 'Reference Date',
                    fieldname: 'reference_date',
                    fieldtype: 'Date',
                    hidden: 1
                },

                {
                    label: 'Purchase Taxes and Charges Template',
                    fieldname: 'taxes_template',
                    fieldtype: 'Link',
                    options: 'Purchase Taxes and Charges Template'
                },

                {
                    label: 'Posting Date',
                    fieldname: 'posting_date',
                    fieldtype: 'Date',
                    default: frappe.datetime.get_today(),
                    reqd: 1
                },

                {
                    fieldname: 'item_code',
                    fieldtype: 'Link',
                    options: 'Item',
                    hidden: 1
                }

            ],

            primary_action_label: 'Submit',

            primary_action(values) {

                if (!values.item_code) {

                    frappe.msgprint(
                        __('Item not found for selected Expense Type')
                    );

                    return;
                }

                if (
                    values.payment_type === "Payment Now"
                    && !values.mode_of_payment
                ) {

                    frappe.msgprint(
                        __('Mode of Payment is required for Payment Now')
                    );

                    return;
                }

                cur_frm.call({

                    doc: cur_frm.doc,

                    method: "create_expense",

                    args: {

                        expense_type: values.expense_type,

                        amount: values.amount,

                        supplier: values.supplier,

                        taxes_template: values.taxes_template,

                        item_code: values.item_code,

                        payment_type: values.payment_type,

                        mode_of_payment: values.mode_of_payment,

                        reference_no: values.reference_no,

                        reference_date: values.reference_date,

                        posting_date: values.posting_date,

                        reference_doctype: frm.doc.doctype,

                        reference_name: frm.doc.name
                    },

                    callback: function(r) {

                        if (!r.exc) {

                            frappe.msgprint(
                                __('Expense Invoice Created: {0}', [r.message])
                            );

                            d.hide();

                            frm.reload_doc();
                        }
                    }
                });
            }
        });

        d.show();
    });
}



//////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////



        // let outsource_rows = frm.doc.tasks.filter(row => row.employee__outsource === "Outsource");

        // // Show button
        // if (outsource_rows.length > 0 
        //     // && frm.doc.status === 'Completed' 
        //     && frm.doc.purchase_invoice_status !== 'Created') 
        //     {


        //     frm.add_custom_button(__('Create Purchase Invoice'), function () {

        //         // -------------------------
        //         // Payment Type Check
        //         // -------------------------
        //         if (!frm.doc.payment_pi) {
        //             frappe.msgprint(__('Please select Payment Type'));
        //             return;
        //         }

        //         if (frm.doc.payment_pi === "Payment Now" && !frm.doc.mode_of_payment_pi) {
        //             frappe.msgprint(__('Mode of Payment is required for Payment Now'));
        //             return;
        //         }

        //         // -------------------------
        //         // Tax Template Popup
        //         // -------------------------
        //         let d = new frappe.ui.Dialog({
        //             title: 'Select Purchase Tax Template',
        //             fields: [
        //                 {
        //                     label: 'Taxes and Charges Template',
        //                     fieldname: 'tax_template',
        //                     fieldtype: 'Link',
        //                     options: 'Purchase Taxes and Charges Template'
        //                 }
        //             ],
        //             primary_action_label: 'Create',
        //             primary_action(values) {

        //                 cur_frm.call({
        //                     doc: cur_frm.doc,
        //                     method: "create_pinvoice",
        //                     args: {
        //                         tax_template: values.tax_template
        //                     },
        //                     callback: function (r) {
        //                         if (r.message) {
        //                             frappe.msgprint(
        //                                 "Purchase Invoice Created: <b>" + r.message.join(", ") + "</b>"
        //                             );
        //                             frm.reload_doc();
        //                         }
        //                     }
        //                 });

        //                 d.hide();
        //             }
        //         });

        //         d.show();

        //     });
        // }



        let outsource_rows = frm.doc.tasks.filter(
            row => row.employee__outsource === "Outsource"
        );

        // Show button
        if (
            outsource_rows.length > 0
            // && frm.doc.status === 'Completed'
        ) {

            addCreate(
                'Create Purchase Invoice',
                function () {

                    // Block ONLY if the tracked outsource Purchase Invoice is
                    // still active (submitted). A cancelled one (docstatus 2) —
                    // or none — frees the Job to create a new one. Expense PIs
                    // don't set this back-ref, so they never block here.
                    let __pi_ref = frm.doc.purchase_invoice;
                    let __pi_check = __pi_ref
                        ? frappe.db.get_value("Purchase Invoice", __pi_ref, "docstatus")
                            .then(r => r && r.message && r.message.docstatus === 1)
                        : Promise.resolve(false);
                    __pi_check.then(active_pi => {

                    if (active_pi) {
                        frappe.msgprint(__('Purchase Invoice already created for this Job.'));
                        return;
                    }

                    // -------------------------
                    // Tax Template + Payment Popup
                    // -------------------------

                    let d = new frappe.ui.Dialog({

                        title: 'Create Purchase Invoice',

                        fields: [

                            {
                                label: 'Posting Date',
                                fieldname: 'posting_date',
                                fieldtype: 'Date',
                                default: frappe.datetime.get_today(),
                                reqd: 1
                            },

                            {
                                label: 'Taxes and Charges Template',
                                fieldname: 'tax_template',
                                fieldtype: 'Link',
                                options: 'Purchase Taxes and Charges Template'
                            },

                            {
                                label: 'Payment',
                                fieldname: 'payment_pi',
                                fieldtype: 'Select',
                                options: 'Credit\nPayment Now',
                                default: frm.doc.payment_pi || 'Credit',
                                reqd: 1
                            },

                            {
                                label: 'Mode of Payment',
                                fieldname: 'mode_of_payment_pi',
                                fieldtype: 'Link',
                                options: 'Mode of Payment',
                                default: frm.doc.mode_of_payment_pi,
                                depends_on: "eval:doc.payment_pi=='Payment Now'",
                                mandatory_depends_on: "eval:doc.payment_pi=='Payment Now'",
                                change() {
                                    jmsToggleReferenceFields(d, "mode_of_payment_pi");
                                }
                            },

                            {
                                label: 'Reference No',
                                fieldname: 'reference_no',
                                fieldtype: 'Data',
                                hidden: 1
                            },

                            {
                                label: 'Reference Date',
                                fieldname: 'reference_date',
                                fieldtype: 'Date',
                                hidden: 1
                            },

                            {
                                fieldname: 'advances_sb',
                                fieldtype: 'Section Break',
                                label: 'Supplier Advances'
                            },
                            {
                                fieldname: 'advances_html',
                                fieldtype: 'HTML'
                            }

                        ],

                        primary_action_label: 'Create',

                        primary_action(values) {

                            let isNow = values.payment_pi === "Payment Now";

                            if (isNow && !values.mode_of_payment_pi) {
                                frappe.msgprint(__('Mode of Payment is required for Payment Now'));
                                return;
                            }

                            let submit = function () {

                                cur_frm.call({

                                    doc: cur_frm.doc,

                                    method: "create_pinvoice",

                                    args: {
                                        tax_template: values.tax_template,
                                        posting_date: values.posting_date,
                                        payment_pi: values.payment_pi,
                                        mode_of_payment_pi: isNow ? values.mode_of_payment_pi : null,
                                        reference_no: values.reference_no,
                                        reference_date: values.reference_date
                                    },

                                    callback: function (r) {
                                        if (r.message) {
                                            frappe.msgprint(
                                                "Purchase Invoice Created: <b>" + r.message.join(", ") + "</b>"
                                            );
                                            frm.reload_doc();
                                            d.hide();
                                        }
                                    }
                                });
                            };

                            if (isNow && values.mode_of_payment_pi) {

                                frappe.db.get_value(
                                    "Mode of Payment",
                                    values.mode_of_payment_pi,
                                    "type"
                                ).then(r => {

                                    if (r.message && r.message.type === "Bank") {

                                        if (!values.reference_no) {
                                            frappe.msgprint(__("Reference No is required"));
                                            return;
                                        }

                                        if (!values.reference_date) {
                                            frappe.msgprint(__("Reference Date is required"));
                                            return;
                                        }
                                    }

                                    submit();
                                });

                            } else {
                                submit();
                            }
                        }
                    });

                    d.show();

                    frappe.call({
                        doc: frm.doc,
                        method: "get_job_unallocated_payments",
                        args: { payment_type: "Pay" },
                        callback: function (r) {
                            jmsRenderAdvancesInfo(d, "advances_html", r.message || []);
                        }
                    });

                    });  // end frappe.db.count(...).then

                }
            );
        }



		// let outsource_rows = frm.doc.tasks.filter(row => row.employee__outsource === "Outsource");

        // // Only show button if there are outsource rows
        // if (outsource_rows.length > 0 && frm.doc.status === 'Completed' && frm.doc.purchase_invoice_status !== 'Created') {
        //     frm.add_custom_button(__('Create Purchase Invoice'), function () {
        //         cur_frm.call({
        //             doc: cur_frm.doc,
        //             method: "create_pinvoice",
        //             args: {},
        //             callback: function (r) {
        //                 if (r.message) {
        //                     frappe.msgprint("Invoice Created: <b>" + r.message + "</b>");
        //                 }
        //             }
        //         });
        //     });
        // }

		
        
      


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
		// Mirror the server-side calculate_amounts() so totals update LIVE
		// without saving. No frm.save() here => the form no longer auto-scrolls
		// to the top when items are added/edited. The server recomputes the
		// same values on the next manual Save.
		let gross = 0, net = 0;
		(frm.doc.items || []).forEach(row => {
			let qty = row.job_qty || 1;
			let twt = ((row.fee_price || 0) + (row.extra || 0) + (row.surcharge || 0)) * qty;
			let vat_amt = row.vat ? twt * (row.vat / 100) : 0;
			let total = twt + vat_amt;
			row.total_without_tax = twt;
			row.vat_amount = vat_amt;
			row.total = total;
			row.cost = total;
			gross += twt;
			net += total;
		});
		frm.refresh_field('items');
		frm.set_value('gross_amount', gross);
		frm.set_value('net_amount', net);
		frm.set_value('balance', net - (frm.doc.discount || 0));
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
				frappe.model.set_value(cdt, cdn, 'old_fee_price', doc.fee_price);
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
		// Recompute every row + the form totals live, client-side.
		// (Previously this auto-saved the form on every edit, which scrolled
		//  the page to the top — see calculate_totals.)
		frm.trigger('calculate_totals');
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


// ============================================================
// JOB PROFIT & PAYMENT TRACKING — financial summary card
// Palette: dark green / dark gold / cream
// ============================================================
function renderJobFinancials(frm) {
    if (!frm.fields_dict.financial_details) {
        return;
    }
    if (frm.is_new()) {
        // The form instance is reused across documents — without a re-render
        // these HTML fields keep the previously opened job's markup.
        // An unsaved job has no lifecycle/work progress yet, so the stepper
        // is cleared rather than drawn with "Created" / "Processing Work"
        // active; it renders on the first refresh after save.
        frm.fields_dict.financial_details.$wrapper.html("");
        if (frm.fields_dict.pipeline_html) {
            frm.fields_dict.pipeline_html.$wrapper.html("");
        }
        return;
    }

    // Dashboard indicators (Amount / Exp Pending)
    frm.dashboard.clear_headline && frm.dashboard.clear_headline();

    frappe.call({
        doc: frm.doc,
        method: "get_financials",
        callback: function (r) {
            if (!r || !r.message) {
                return;
            }
            const fin = r.message;

            // Per-job pipeline stepper (this job's own progress — lifecycle +
            // work/money stage, current step highlighted) into the HTML field.
            if (frm.fields_dict.pipeline_html) {
                frm.fields_dict.pipeline_html.$wrapper.html(buildJobPipeline(frm, fin));
            }

            const currency = fin.currency || frappe.defaults.get_default("currency");
            const fmt = (v) => format_currency(v, currency);

            const labels = {
                total_job_amount: "Total Job Amount",
                total_received: "Total Amount Received",
                outstanding: "Outstanding to Receive",
                total_expenses: "Total Expenses",
                outsourcing_cost: "Outsourcing Costs",
                paid_out: "Paid Out (Supplier/Agent)",
                net_profit: "Net Profit",
                profit_balance: "Profit Balance"
            };

            const GREEN = "#1b4332";
            const GOLD = "#b8860b";
            const CREAM = "#faf8f1";

            let rows = "";
            (fin.metrics || []).forEach((m) => {
                if (!m.visible) return;
                const isProfit = m.key === "net_profit";
                const negative = m.value < 0;
                const valColor = isProfit
                    ? (negative ? "#a4161a" : GREEN)
                    : "#2b2b2b";
                const weight = isProfit ? "700" : "500";
                rows += `
                    <div style="display:flex;justify-content:space-between;align-items:center;
                                padding:7px 14px;border-bottom:1px solid #eee5cf;">
                        <span style="color:#5c5343;font-size:12px;">${labels[m.key] || m.key}</span>
                        <span style="color:${valColor};font-weight:${weight};font-size:13px;">${fmt(m.value)}</span>
                    </div>`;
            });

            // Received split (customer vs agent)
            let split = "";
            if ((fin.received_from_agent || 0) > 0 || fin.received_from === "Agent") {
                split = `
                    <div style="padding:6px 14px;font-size:11px;color:#7a6f59;background:#f3edda;">
                        Received From: <b>${frappe.utils.escape_html(fin.received_from || "—")}</b>
                        &nbsp;·&nbsp; Customer: ${fmt(fin.received_from_customer || 0)}
                        &nbsp;·&nbsp; Agent: ${fmt(fin.received_from_agent || 0)}
                    </div>`;
            }

            // Status badges
            let badges = "";
            const ind = fin.indicators || {};
            if (ind.show) {
                if (ind.amount_pending) {
                    badges += `<span style="background:#a4161a;color:#fff;border-radius:10px;
                        padding:2px 10px;font-size:11px;margin-right:6px;">Amount Pending</span>`;
                }
                if (ind.exp_pending) {
                    badges += `<span style="background:${GOLD};color:#fff;border-radius:10px;
                        padding:2px 10px;font-size:11px;">Exp. Pending</span>`;
                }
            }
            const badgeBar = badges
                ? `<div style="padding:8px 14px;background:${CREAM};">${badges}</div>`
                : "";

            const html = `
                <div style="border:1px solid #e0d6b8;border-left:4px solid ${GOLD};
                            border-radius:8px;overflow:hidden;max-width:520px;background:#fff;">
                    <div style="background:${GREEN};color:${CREAM};padding:9px 14px;
                                font-weight:600;font-size:13px;letter-spacing:.3px;">
                        Job Financial Summary
                    </div>
                    ${rows}
                    ${split}
                    ${badgeBar}
                </div>`;

            frm.fields_dict.financial_details.$wrapper.html(html);

            // Form dashboard indicators too
            if (ind.show) {
                if (ind.amount_pending) {
                    frm.dashboard.add_indicator(__("Amount Pending"), "red");
                }
                if (ind.exp_pending) {
                    frm.dashboard.add_indicator(__("Exp. Pending"), "orange");
                }
            }
        }
    });
}


// ============================================================
// Reconciliation allocation table (shared by payment/invoice dialogs)
// ============================================================
function jmsRenderAllocation(d, html_fieldname, items, get_amount, opts) {
    opts = opts || {};
    const $w = d.fields_dict[html_fieldname].$wrapper;
    if (!items || !items.length) {
        $w.html('<div class="text-muted" style="padding:6px 2px;">No open '
            + (opts.empty || 'items') + ' for this job.</div>');
        return;
    }
    const rows = items.map(it => `
        <tr>
            <td>${frappe.utils.escape_html(it.key)}</td>
            <td class="text-right">${format_currency(it.outstanding)}</td>
            <td><input type="number" class="form-control input-xs jms-alloc"
                 data-key="${frappe.utils.escape_html(it.key)}" data-out="${it.outstanding}"
                 min="0" step="0.01" style="width:130px;"></td>
        </tr>`).join("");
    $w.html(`
        <table class="table table-bordered" style="margin-bottom:4px;font-size:12px;">
            <thead><tr>
                <th>${opts.key_label || 'Document'}</th>
                <th class="text-right">Outstanding</th>
                <th>Allocate</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>`);
    jmsAutofillAllocation(d, html_fieldname, get_amount);
}

function jmsAutofillAllocation(d, html_fieldname, get_amount) {
    let remaining = flt(get_amount && get_amount());
    d.fields_dict[html_fieldname].$wrapper.find(".jms-alloc").each(function () {
        const out = parseFloat($(this).data("out")) || 0;
        const alloc = Math.min(out, Math.max(0, remaining));
        $(this).val(alloc ? alloc.toFixed(2) : "");
        remaining = Math.max(0, remaining - alloc);
    });
}

function jmsCollectAllocations(d, html_fieldname) {
    const out = [];
    d.fields_dict[html_fieldname].$wrapper.find(".jms-alloc").each(function () {
        const amt = parseFloat($(this).val()) || 0;
        if (amt > 0) out.push({ key: $(this).data("key"), allocated_amount: amt });
    });
    return out;
}

// Read-only panel showing the unallocated advances that will be auto-applied
// to the invoice being created (transparency on the invoice-first flow).
function jmsRenderAdvancesInfo(d, html_fieldname, payments) {
    const $w = d.fields_dict[html_fieldname].$wrapper;
    if (!payments || !payments.length) {
        $w.html('<div class="text-muted" style="padding:4px 2px;">No advance payments available to apply.</div>');
        return;
    }
    const rows = payments.map(p => `<tr>
        <td>${frappe.utils.escape_html(p.name)}</td>
        <td>${frappe.utils.escape_html(p.party || '')}</td>
        <td class="text-right">${format_currency(p.unallocated_amount)}</td>
    </tr>`).join("");
    $w.html(`
        <div class="text-muted" style="margin-bottom:3px;">These advances will be auto-applied to the invoice (FIFO):</div>
        <table class="table table-bordered" style="font-size:12px;">
            <thead><tr><th>Payment</th><th>Party</th><th class="text-right">Available</th></tr></thead>
            <tbody>${rows}</tbody>
        </table>`);
}

// Show the Reference No / Reference Date fields in a dialog only when the
// selected Mode of Payment is of type "Bank". Used by the creation dialogs so
// reference details are requested only when relevant.
function jmsToggleReferenceFields(d, mop_fieldname) {
    let mop = d.get_value(mop_fieldname || "mode_of_payment");
    if (!mop) {
        d.set_df_property("reference_no", "hidden", 1);
        d.set_df_property("reference_date", "hidden", 1);
        d.refresh();
        return;
    }
    frappe.db.get_value("Mode of Payment", mop, "type").then(r => {
        let isBank = r.message && r.message.type === "Bank";
        d.set_df_property("reference_no", "hidden", isBank ? 0 : 1);
        d.set_df_property("reference_date", "hidden", isBank ? 0 : 1);
        d.set_df_property("reference_no", "reqd", isBank ? 1 : 0);
        d.set_df_property("reference_date", "reqd", isBank ? 1 : 0);
        d.refresh();
    });
}


// Per-job pipeline stepper shown on the Job form dashboard. Highlights where
// THIS job currently sits: row 1 = lifecycle (from status), row 2 = work/money
// stage (tasks completion + net receivable/payable from get_financials).
function buildJobPipeline(frm, fin) {
    const dead = ["Cancelled", "Canceled", "Rejected"].includes(frm.doc.status);

    // lifecycle position
    const life = ["Created", "In Progress", "Completed", "Closed"];
    let li = life.indexOf(frm.doc.status);
    if (li === -1) {
        if (frm.doc.status === "Closed") li = 3;
        else if (["Processing", "Supervisor Approved", "MD Approved"].includes(frm.doc.status)) li = 1;
        else li = 0;
    }

    // work/money stage
    const tasks = frm.doc.tasks || [];
    const tasksDone = tasks.length === 0 || tasks.every((t) => t.status === "Completed");
    const stages = ["Processing Work", "Invoice Pending", "Amount Pending", "Exp Pending", "Completed"];
    let si;
    if (frm.is_new() || !tasksDone) si = 0;         // new doc / work not finished
    else if (!fin.has_sales_invoice) si = 1;        // done but not billed yet (Create Sales Invoice)
    else if (flt(fin.net_receivable) > 0) si = 2;   // billed, collection pending
    else if (flt(fin.net_payable) > 0) si = 3;      // collected, supplier/expense pending
    else si = 4;                                    // fully settled

    function rowHtml(title, steps, activeIdx) {
        const cells = steps.map((label, i) => {
            let cls = "future";
            if (!dead) {
                if (i < activeIdx) cls = "done";
                else if (i === activeIdx) cls = "active";
            }
            const mark = cls === "done" ? "&#10003;" : cls === "active" ? "&#9679;" : "&#9675;";
            const arrow = i < steps.length - 1 ? '<div class="jp-arrow">&#8594;</div>' : "";
            return `<div class="jp-step ${cls}"><div class="jp-chk">${mark}</div>`
                + `<div class="jp-lbl">${frappe.utils.escape_html(label)}</div></div>${arrow}`;
        }).join("");
        return `<div class="jp-rowtitle">${title}</div><div class="jp-stepper">${cells}</div>`;
    }

    const css = `<style>
    .sbm-jobpipe .jp-rowtitle{font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.04em;margin:10px 2px 6px;}
    .sbm-jobpipe .jp-stepper{display:flex;align-items:stretch;flex-wrap:wrap;margin-bottom:12px;}
    .sbm-jobpipe .jp-step{border-radius:8px;padding:10px 16px;min-width:135px;text-align:center;border:1px solid #e5e7eb;background:#f9fafb;}
    .sbm-jobpipe .jp-step .jp-chk{width:18px;height:18px;line-height:18px;border-radius:50%;margin:0 auto 4px;font-size:11px;background:#d1d5db;color:#fff;}
    .sbm-jobpipe .jp-step .jp-lbl{font-size:11.5px;color:#6b7280;font-weight:600;}
    .sbm-jobpipe .jp-step.done{background:#e9f7ef;border-color:#c8ebd6;}
    .sbm-jobpipe .jp-step.done .jp-chk{background:#16a34a;}
    .sbm-jobpipe .jp-step.done .jp-lbl{color:#166848;}
    .sbm-jobpipe .jp-step.active{background:#fff;border:2px solid #16a34a;box-shadow:0 2px 8px rgba(22,121,72,.15);}
    .sbm-jobpipe .jp-step.active .jp-chk{background:#16a34a;}
    .sbm-jobpipe .jp-step.active .jp-lbl{color:#14532d;font-weight:700;}
    .sbm-jobpipe .jp-arrow{color:#9ca3af;padding:0 4px;display:flex;align-items:center;}
    .sbm-jobpipe .jp-dead{color:#a4161a;font-size:12px;margin:4px 2px;font-weight:600;}
    </style>`;

    let html = css + '<div class="sbm-jobpipe">';
    if (dead) {
        html += `<div class="jp-dead">${__("This job is")} ${frappe.utils.escape_html(frm.doc.status)}.</div>`;
    }
    html += rowHtml(__("Lifecycle"), life, li);
    html += rowHtml(__("Work &amp; Money"), stages, si);
    html += "</div>";
    return html;
}

