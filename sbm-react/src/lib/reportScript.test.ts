import dayjs from "dayjs";
import { afterEach, describe, expect, it } from "vitest";

import { readFilters, selectOptions } from "./reportScript";

const script = `
frappe.query_reports["Cash Collection"] = {
	"filters": [
		{ "fieldname": "company", "label": __("Company"), "fieldtype": "Link", "options": "Company",
		  "default": frappe.defaults.get_user_default("Company") },
		{ "fieldname": "from_date", "fieldtype": "Date", "default": frappe.datetime.month_start() },
		{ "fieldname": "to_date", "fieldtype": "Date",
		  "default": frappe.datetime.add_months(frappe.datetime.get_today(), -1) },
		{ "fieldname": "status", "fieldtype": "Select", "options": ["", "Open", "Closed"].join("\\n") },
	],
	formatter(value, row, column, data, default_formatter) { return frappe.ui.whatever(value); },
	onload(report) { report.page.add_inner_button("x", () => {}); },
};
frappe.ui.form.on("Something", {});
`;

describe("readFilters", () => {
	afterEach(() => (window.boot = undefined));

	it("reads the filters and works out their defaults", () => {
		window.boot = { user: "a@b.c", company: "Oasis" };
		const filters = readFilters(script, "Cash Collection");
		expect(filters.map((f) => f.fieldname)).toEqual([
			"company",
			"from_date",
			"to_date",
			"status",
		]);
		expect(filters[0]).toMatchObject({ label: "Company", default: "Oasis" });
		expect(filters[1].default).toBe(dayjs().startOf("month").format("YYYY-MM-DD"));
		expect(filters[2].default).toBe(dayjs().add(-1, "month").format("YYYY-MM-DD"));
		expect(selectOptions(filters[3].options)).toEqual(["Open", "Closed"]);
	});

	it("gives no filters for a broken or other script", () => {
		expect(readFilters("this is not js", "X")).toEqual([]);
		expect(readFilters(script, "Other Report")).toEqual([]);
	});
});
