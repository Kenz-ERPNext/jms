// One report: its filters (from the report's JS) and its result for given filter
// values (frappe.desk.query_report.run).

import { useQuery } from "@tanstack/react-query";

import { callMethod } from "@/lib/frappe";
import { loadFilters } from "@/lib/reportScript";

export interface ReportColumn {
	fieldname: string;
	label: string;
	fieldtype?: string;
	options?: string;
	width?: number;
}

export type ReportRow = Record<string, unknown> | unknown[];

interface ReportResult {
	columns: (ReportColumn | string)[];
	result: ReportRow[];
	message?: string;
	report_summary?: { label: string; value: unknown; datatype?: string; indicator?: string }[];
}

/** Old-style columns are strings: "Label:Fieldtype/Options:Width". */
export function toColumn(col: ReportColumn | string, i: number): ReportColumn {
	if (typeof col !== "string") return col;
	const [label, type = "Data", width] = col.split(":");
	const [fieldtype, options] = type.split("/");
	return { fieldname: `col_${i}`, label, fieldtype, options, width: Number(width) || undefined };
}

export function useReportFilters(report: string) {
	return useQuery({
		queryKey: ["report-filters", report],
		queryFn: () => loadFilters(report),
		staleTime: Infinity,
	});
}

export function useReportResult(report: string, filters: Record<string, unknown> | undefined) {
	return useQuery({
		queryKey: ["report-result", report, filters],
		queryFn: async () => {
			const res = await callMethod<ReportResult>("frappe.desk.query_report.run", {
				report_name: report,
				filters,
			});
			const columns = (res.columns ?? []).map(toColumn);
			return { ...res, columns };
		},
		enabled: !!filters,
	});
}
