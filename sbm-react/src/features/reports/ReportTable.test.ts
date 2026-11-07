import { describe, expect, it } from "vitest";

import { linkTarget, toRows, toCsv } from "./reportRows";
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

	it("links vouchers by their row's doctype and jobs from dimension columns", () => {
		const voucher = {
			fieldname: "voucher_no",
			label: "Voucher No",
			fieldtype: "Dynamic Link",
			options: "voucher_type",
		};
		const job = { fieldname: "job", label: "Job", options: "Job" };
		const [row, total] = toRows(
			[
				{ voucher_type: "Payment Entry", voucher_no: "ACC-PAY-1", job: "JOB-1/26" },
				{ voucher_type: "", voucher_no: "'Total'", job: "" },
			],
			[voucher, job],
		);
		expect(linkTarget(row.voucher_no, row, voucher)).toEqual({
			doctype: "Payment Entry",
			name: "ACC-PAY-1",
		});
		expect(linkTarget(row.job, row, job)).toEqual({ doctype: "Job", name: "JOB-1/26" });
		expect(linkTarget(total.voucher_no, total, voucher)).toBeNull();
	});

	it("links Link columns, but not quoted labels like 'Opening'", () => {
		const gle = {
			fieldname: "gl_entry",
			label: "GL Entry",
			fieldtype: "Link",
			options: "GL Entry",
		};
		const account = {
			fieldname: "account",
			label: "Account",
			fieldtype: "Link",
			options: "Account",
		};
		const [row, opening] = toRows(
			[
				{ gl_entry: "ACC-GLE-1", account: "2110 - Creditors" },
				{ gl_entry: "", account: "'Opening'" },
			],
			[gle, account],
		);
		expect(linkTarget(row.gl_entry, row, gle)).toEqual({
			doctype: "GL Entry",
			name: "ACC-GLE-1",
		});
		expect(linkTarget(opening.account, opening, account)).toBeNull();
	});
});
