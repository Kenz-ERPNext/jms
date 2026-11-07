import { describe, expect, it } from "vitest";

import { display, docStatus, linkOf, toSections, type DocMeta } from "./docView";

const meta: DocMeta = {
	name: "Payment Entry",
	fields: [
		{ fieldname: "posting_date", label: "Date", fieldtype: "Date" },
		{ fieldname: "party_type", label: "Party Type", fieldtype: "Link", options: "DocType" },
		{ fieldname: "party", label: "Party", fieldtype: "Dynamic Link", options: "party_type" },
		{ fieldname: "secret", label: "Secret", fieldtype: "Data", hidden: 1 },
		{ fieldname: "sb1", label: "Amounts", fieldtype: "Section Break" },
		{ fieldname: "paid_amount", label: "Paid", fieldtype: "Currency", options: "currency" },
		{ fieldname: "discount", label: "Discount", fieldtype: "Currency" },
		{ fieldname: "sb2", label: "Empty", fieldtype: "Section Break" },
		{ fieldname: "remarks", label: "Remarks", fieldtype: "Small Text" },
		{ fieldname: "sb3", label: "References", fieldtype: "Section Break" },
		{ fieldname: "references", label: "References", fieldtype: "Table", options: "Ref" },
	],
};
const metas: Record<string, DocMeta> = {
	"Payment Entry": meta,
	Ref: {
		name: "Ref",
		fields: [
			{ fieldname: "reference_name", label: "Name", fieldtype: "Data", in_list_view: 1 },
			{ fieldname: "outstanding", label: "Out", fieldtype: "Currency", in_list_view: 1 },
			{ fieldname: "idx_note", label: "Note", fieldtype: "Data" },
		],
	},
};
const doc = {
	name: "PE-1",
	docstatus: 1,
	posting_date: "2026-11-07",
	party_type: "Customer",
	party: "Oasis",
	secret: "x",
	paid_amount: 750,
	currency: "SAR",
	discount: 0,
	remarks: "",
	references: [{ name: "r1", reference_name: "SI-1", outstanding: 0 }],
};

describe("document viewer", () => {
	it("keeps fields with a value, by section, and drops empty sections", () => {
		const sections = toSections(meta, doc, metas);
		expect(sections.map((s) => s.label)).toEqual(["", "Amounts", "References"]);
		expect(sections[0].fields.map((f) => f.field.fieldname)).toEqual([
			"posting_date",
			"party_type",
			"party",
		]);
		expect(sections[1].fields.map((f) => f.field.fieldname)).toEqual(["paid_amount"]);
		expect(sections[2].tables[0].columns.map((c) => c.fieldname)).toEqual(["reference_name"]);
	});

	it("links Link and Dynamic Link fields", () => {
		expect(linkOf(meta.fields[2], doc)).toEqual({ doctype: "Customer", name: "Oasis" });
		expect(linkOf(meta.fields[0], doc)).toBeNull();
	});

	it("formats by type and reads the status", () => {
		expect(display(750, meta.fields[5], doc)).toContain("750");
		expect(display("2026-11-07", meta.fields[0])).toBe("07 Nov 2026");
		expect(docStatus(doc)).toBe("Submitted");
	});
});
