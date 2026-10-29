import { describe, expect, it } from "vitest";

import { toServerNames } from "./quickEntryExtras";
import { nameField, quickFields, type DocMeta } from "./quickEntryMeta";

const customer: DocMeta = {
	autoname: "naming_series:",
	title_field: "customer_name",
	fields: [
		{ fieldname: "naming_series", fieldtype: "Select", reqd: 1 },
		{ fieldname: "customer_name", label: "Customer Name", fieldtype: "Data", reqd: 1 },
		{ fieldname: "customer_type", fieldtype: "Select", reqd: 1, default: "Company" },
		{ fieldname: "mobile_no", fieldtype: "Data", allow_in_quick_entry: 1 },
		{ fieldname: "tax_id", fieldtype: "Data" },
		{ fieldname: "hidden_one", fieldtype: "Data", reqd: 1, hidden: 1 },
		{ fieldname: "sec", fieldtype: "Section Break", allow_in_quick_entry: 1 },
	],
};

describe("quickFields", () => {
	it("keeps mandatory and quick entry fields, not the series, hidden or layout ones", () => {
		expect(quickFields(customer).map((f) => f.fieldname)).toEqual([
			"customer_name",
			"customer_type",
			"mobile_no",
		]);
	});
});

describe("nameField", () => {
	it("is the field the name comes from", () => {
		const jobType: DocMeta = {
			autoname: "field:job_type_name",
			fields: [{ fieldname: "job_type_name", fieldtype: "Data", reqd: 1 }],
		};
		expect(nameField(jobType, quickFields(jobType))).toBe("job_type_name");
	});

	it("else the title field", () => {
		expect(nameField(customer, quickFields(customer))).toBe("customer_name");
	});

	it("else the first text field, when the title is worked out", () => {
		const employee: DocMeta = {
			autoname: "naming_series:",
			title_field: "employee_name",
			fields: [
				{ fieldname: "employee_name", fieldtype: "Data", read_only: 1 },
				{ fieldname: "first_name", fieldtype: "Data", reqd: 1 },
			],
		};
		expect(nameField(employee, quickFields(employee))).toBe("first_name");
	});
});

describe("toServerNames", () => {
	it("renames the contact aliases and drops empty values", () => {
		expect(
			toServerNames({
				customer_name: "Demo",
				email_address: "a@b.c",
				mobile_number: "0500",
				map_to_first_name: "Ali",
				address_line1: "",
				city: undefined,
			}),
		).toEqual({
			customer_name: "Demo",
			email_id: "a@b.c",
			mobile_no: "0500",
			first_name: "Ali",
		});
	});
});
