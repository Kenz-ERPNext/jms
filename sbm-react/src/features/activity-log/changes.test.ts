import { describe, expect, it } from "vitest";

import { changeSummary, parseChanges } from "./changes";

const details = [
	"Total Quantity: 31 → 35",
	"Quantity (Items row 2 – 898 (SAR 1,000.00)): 1 → 5",
	"Remarks: (empty) → Paid by cash",
	"Items: removed 898",
].join("\n");

describe("parseChanges", () => {
	const rows = parseChanges(details);

	it("reads field, before and after", () => {
		expect(rows[0]).toEqual({
			field: "Total Quantity",
			where: undefined,
			before: "31",
			after: "35",
		});
	});
	it("keeps the table row a change is in", () => {
		expect(rows[1]).toMatchObject({
			field: "Quantity",
			where: "Items row 2 – 898 (SAR 1,000.00)",
		});
	});
	it("treats (empty) as no value", () => {
		expect(rows[2]).toMatchObject({ before: undefined, after: "Paid by cash" });
	});
	it("reads added and removed rows as notes", () => {
		expect(rows[3]).toEqual({ field: "Items", where: undefined, note: "removed 898" });
	});
	it("drops left-overs of an HTML value", () => {
		const html =
			"Total Quantity: 2 → 31\nTaxes and Charges Calculation: Item\n\t\tTaxable Amount\n\tVAT 0 → Item";
		expect(parseChanges(html)).toEqual([
			{ field: "Total Quantity", where: undefined, before: "2", after: "31" },
		]);
	});

	it("sums up the first changes", () => {
		expect(changeSummary(rows)).toBe("Total Quantity 31 → 35 · Quantity 1 → 5 · +2 more");
	});
});
