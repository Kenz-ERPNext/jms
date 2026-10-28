// Turning a report's raw rows into table rows: values formatted by column type,
// HTML in cells read as text, total lines and section headings marked, empty rows
// and columns left out. Shared by the plain table and the sectioned view.

import { formatDate, formatMoney } from "@/lib/format";
import { fromHtml } from "@/lib/html";

import type { ReportColumn, ReportRow } from "./useReport";

export type Row = Record<string, unknown> & {
	_key: number;
	/** A total line: bold, shaded. */
	_total: boolean;
	/** A section heading ("▶ Sales Summary"): its text, shown across the row. */
	_heading?: string;
};

export const empty = (v: unknown) => v === null || v === undefined || v === "";

export const NUMBER = ["Currency", "Float", "Int", "Percent"];

export function show(value: unknown, col: ReportColumn): string {
	if (value === null || value === undefined || value === "") return "";
	// numbers may come wrapped in HTML too ("<b>332.45</b>")
	const plain = fromHtml(String(value)).text;
	if (col.fieldtype === "Currency") return formatMoney(Number(plain));
	if (col.fieldtype === "Date") return formatDate(plain);
	if (col.fieldtype === "Percent") return `${Number(plain).toLocaleString()}%`;
	if (col.fieldtype === "Float" || col.fieldtype === "Int")
		return Number(plain).toLocaleString();
	return plain;
}

export function toRows(rows: ReportRow[], columns: ReportColumn[]): Row[] {
	return rows
		.map((r, i) => {
			const obj = Array.isArray(r)
				? Object.fromEntries(columns.map((c, j) => [c.fieldname, r[j]]))
				: r;
			const first = obj[columns[0]?.fieldname];
			const cells = columns
				.map((c) => obj[c.fieldname])
				.filter((v): v is string => typeof v === "string")
				.map(fromHtml);
			return {
				...obj,
				_key: i,
				_total:
					(typeof first === "string" && /^'?total'?$/i.test(first.trim())) ||
					cells.some((c) => c.bold && !c.heading),
				_heading: cells.find((c) => c.heading)?.text,
			} as Row;
		})
		.filter((r) => columns.some((c) => !empty(r[c.fieldname])));
}

/** The columns that have a value in at least one row. */
export function usedColumns(rows: Row[], columns: ReportColumn[]): ReportColumn[] {
	return columns.filter((c) => rows.some((r) => !r._heading && !empty(r[c.fieldname])));
}

export function toCsv(rows: Row[], columns: ReportColumn[]): string {
	const cell = (v: unknown) => `"${fromHtml(String(v ?? "")).text.replace(/"/g, '""')}"`;
	return [
		columns.map((c) => cell(c.label)).join(","),
		...rows.map((r) => columns.map((c) => cell(r[c.fieldname])).join(",")),
	].join("\n");
}
