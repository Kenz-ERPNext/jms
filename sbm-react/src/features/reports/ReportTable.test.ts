import { describe, expect, it } from "vitest";

import { toRows, toCsv } from "./reportRows";
import { toColumn } from "./useReport";

describe("report table helpers", () => {
	const columns = [
		toColumn("Job:Link/Job:120", 0),
		toColumn({ fieldname: "amount", label: "Amount", fieldtype: "Currency" }, 1),
	];

	it("reads old string columns", () => {
		expect(columns[0]).toEqual({
			fieldname: "col_0",
			label: "Job",
			fieldtype: "Link",
			options: "Job",
			width: 120,
		});
	});

	it("turns list rows into objects and marks the total row", () => {
		const rows = toRows(
			[
				["JOB-1", 10],
				["Total", 10],
			],
			columns,
		);
		expect(rows[0]).toMatchObject({ col_0: "JOB-1", amount: 10, _total: false });
		expect(rows[1]._total).toBe(true);
	});

	it("writes CSV with quotes escaped", () => {
		const rows = toRows([{ col_0: 'a "b"', amount: 5 }], columns);
		expect(toCsv(rows, columns)).toBe('"Job","Amount"\n"a ""b""","5"');
	});
});
