


frappe.ui.form.on('Outsourced Party', {

	refresh: function(frm) {
        frm.set_query("linked_supplier", function() {
            return {
                filters: {
                    custom_outsourced_party: 1,
					
                }
            };
        });
    }
})