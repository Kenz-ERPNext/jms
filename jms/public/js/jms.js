
// Inside a Dialog, Frappe's ControlDate skips its "open above or below"
// logic (it only runs when the control belongs to a form), so the calendar
// always opens BELOW the input. In tall dialogs (Create Expense etc.) on small
// screens, the Posting Date sits at the bottom of the viewport, the calendar
// falls off-screen, and scrolling the modal blurs the input and closes it.
// Make the picker viewport-aware for dialog fields: open above when there is
// no room below but enough room above.
$(document).ready(function () {
	if (!frappe.ui.form.ControlDate) return;

	const original = frappe.ui.form.ControlDate.prototype.update_datepicker_position;

	frappe.ui.form.ControlDate.prototype.update_datepicker_position = function () {
		const in_modal = this.$input && this.$input.closest(".modal").length > 0;
		if (!in_modal || !this.datepicker) {
			return original.apply(this, arguments);
		}

		const rect = this.$input[0].getBoundingClientRect();
		const picker_height = this.datepicker.$datepicker.outerHeight() + 12;
		const space_below = window.innerHeight - rect.bottom;
		const space_above = rect.top;

		let position = "bottom left";
		if (space_below < picker_height && space_above >= picker_height) {
			position = "top left";
		}
		this.datepicker.update("position", position);
	};
});
