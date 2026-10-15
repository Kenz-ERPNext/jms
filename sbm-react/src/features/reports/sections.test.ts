import { describe, expect, it } from "vitest";

import { toRows } from "./reportRows";
import { toSections } from "./sections";
import type { ReportColumn } from "./useReport";

const columns: ReportColumn[] = [
	{ fieldname: "sl_no", label: "SL No", fieldtype: "Int" },
	{ fieldname: "voucher_no", label: "Voucher", fieldtype: "Data" },
	{ fieldname: "total", label: "Total", fieldtype: "Currency" },
];
const head = (t: string) => ({
	voucher_no: `<div style='background-color:#d1f2eb'>&nbsp;▶ ${t}</div>`,
});

describe("toSections", () => {
	const rows = toRows(
		[
			head("Purchase Summary"),
			{ voucher_no: "Cash Purchases", total: "332.45" },
			{ voucher_no: "Credit Purchases" },
			{ voucher_no: "<b>Total Net Purchases</b>", total: "<b>332.45</b>" },
			{},
			head("Purchase Details"),
			{ sl_no: 1, voucher_no: "PINV-1", total: 141.45 },
			head("Sales Return Details"),
			{ voucher_no: "No records found" },
		],
		columns,
	);
	const sections = toSections(rows, columns);

	it("splits rows at each heading", () => {
		expect(sections.map((s) => s.title)).toEqual([
			"Purchase Summary",
			"Purchase Details",
			"Sales Return Details",
		]);
	});
	it("tells summaries from document lists", () => {
		expect(sections.map((s) => s.kind)).toEqual(["summary", "details", "details"]);
	});
	it("keeps the total line of a summary and drops 'No records found'", () => {
		expect(sections[0].rows.at(-1)?._total).toBe(true);
		expect(sections[2].rows).toEqual([]);
	});
});
