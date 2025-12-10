


frappe.ui.form.on('Agent', {

	refresh: function(frm) {
        frm.set_query("linked_customer", function() {
            return {
                filters: {
                    custom_agent: 1,
					
                }
            };
        });
    }
})