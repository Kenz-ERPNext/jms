// A report whose rows carry section headings ("▶ Sales Summary", "▶ Sales Details")
// split into sections. A summary section is a few label = amount lines (shown as a
// card); a details section is a list of documents (shown as a table).

import { empty, type Row } from "./reportRows";
import type { ReportColumn } from "./useReport";

export interface Section {
	title: string;
	kind: "summary" | "details";
	rows: Row[];
}

const filled = (r: Row, columns: ReportColumn[]) => columns.filter((c) => !empty(r[c.fieldname]));

export function hasSections(rows: Row[]): boolean {
	return rows.some((r) => r._heading);
}

export function toSections(rows: Row[], columns: ReportColumn[]): Section[] {
	const sections: Section[] = [];
	for (const row of rows) {
		if (row._heading || !sections.length) {
			sections.push({
				title: (row._heading ?? "").replace(/^[▶►\s]+/, ""),
				kind: "details",
				rows: [],
			});
			if (row._heading) continue;
		}
		sections[sections.length - 1].rows.push(row);
	}
	for (const s of sections) {
		const money = s.rows.some((r) => filled(r, columns).length === 2);
		const lines = s.rows.every((r) => filled(r, columns).length <= 2);
		s.kind = money && lines ? "summary" : "details";
		// "No records found" and similar one-text lines are not documents
		if (s.kind === "details") s.rows = s.rows.filter((r) => filled(r, columns).length > 1);
	}
	return sections;
}
