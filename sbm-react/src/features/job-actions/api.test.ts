import { describe, expect, it } from "vitest";

import { allocate, defaultTemplate } from "./api";
import { names, outsourceSuppliers } from "./types";

const inv = (name: string, outstanding_amount: number) => ({
	name,
	posting_date: "2026-01-01",
	grand_total: outstanding_amount,
	outstanding_amount,
	party: "P",
});

describe("allocate (as the ERPNext dialogs)", () => {
	it("pays the oldest invoice first and keeps the rest as advance", () => {
		expect(allocate(150, [inv("A", 100), inv("B", 100)])).toEqual({
			rows: [
				{ invoice: "A", allocated_amount: 100 },
				{ invoice: "B", allocated_amount: 50 },
			],
			leftOver: 0,
		});
		expect(allocate(250, [inv("A", 100)])).toEqual({
			rows: [{ invoice: "A", allocated_amount: 100 }],
			leftOver: 150,
		});
		expect(allocate(0, [inv("A", 100)]).rows).toEqual([]);
	});
});

describe("defaultTemplate", () => {
	it("prefers VAT 0, then the default, then the first", () => {
		expect(defaultTemplate([{ name: "KSA 15" }, { name: "x", title: "VAT 0%" }])).toBe("x");
		expect(defaultTemplate([{ name: "A" }, { name: "B", is_default: 1 }])).toBe("B");
		expect(defaultTemplate([{ name: "A" }])).toBe("A");
		expect(defaultTemplate([])).toBeUndefined();
	});
});

describe("outsourceSuppliers", () => {
	const job = {
		name: "J",
		items: [],
		tasks: [
			{
				employee__outsource: "Outsource",
				outsource_supplier: "S1",
				purchase_invoice: "PI-1",
			},
			{ employee__outsource: "Outsource", outsource_supplier: "S2" },
			{ employee__outsource: "Outsource", outsource_supplier: "S2" },
			{ employee__outsource: "Employee" },
		],
	};
	it("lists each supplier once; unbilled only leaves out invoiced tasks", () => {
		expect(outsourceSuppliers(job)).toEqual(["S1", "S2"]);
		expect(outsourceSuppliers(job, true)).toEqual(["S2"]);
	});

	it("reads one name or a list of names", () => {
		expect(names("SI-1")).toEqual(["SI-1"]);
		expect(names(["PE-1", "PE-2"])).toEqual(["PE-1", "PE-2"]);
		expect(names(null)).toEqual([]);
	});
});
