frappe.ui.form.on('Purchase Invoice', { 

    refresh(frm) {
        frappe.db.get_value('Company', frm.doc.company, 'custom_purchase_taxes_and_charges_template')
                .then(r => {
                    if (r && r.message && r.message.custom_purchase_taxes_and_charges_template) {
                        frm.set_value('taxes_and_charges', r.message.custom_purchase_taxes_and_charges_template);
                    } else {
                        frappe.msgprint(`Default Tax not found for company: ${frm.doc.company}`);
                    }
                });
            },

})