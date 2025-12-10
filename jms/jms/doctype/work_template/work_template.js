frappe.ui.form.on('Work Template', {

	refresh: function(frm) {
        // frappe.msgprint("hii")
    },

    tax_templates: function(frm) {
        if (!frm.doc.tax_templates) return;

        cur_frm.call({
			doc: cur_frm.doc,
			method: "vat_rate",
			args: {
            },
			callback: function(r) {
				if (r.message) {
					frm.refresh_field("vat");
				}
			}
		});
	},
})