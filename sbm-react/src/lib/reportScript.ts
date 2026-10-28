// Reads a Script Report's filters from its own JS (the file ERPNext desk runs), so
// SBM shows the same filters without a copy of them. The script is run with a small
// stand-in for `frappe` that records frappe.query_reports and answers the date and
// default helpers the filter defaults use. Anything else is a harmless no-op.

import dayjs from "dayjs";

import { getBoot } from "./boot";
import { callMethod } from "./frappe";

export interface ReportFilter {
	fieldname: string;
	label?: string;
	fieldtype: string;
	options?: string | string[];
	default?: unknown;
	reqd?: number | boolean;
}

const DATE = "YYYY-MM-DD";
const day = (d?: string) => (d ? dayjs(d) : dayjs());

const datetime = {
	get_today: () => dayjs().format(DATE),
	nowdate: () => dayjs().format(DATE),
	now_date: () => dayjs().format(DATE),
	month_start: () => dayjs().startOf("month").format(DATE),
	month_end: () => dayjs().endOf("month").format(DATE),
	year_start: () => dayjs().startOf("year").format(DATE),
	year_end: () => dayjs().endOf("year").format(DATE),
	add_days: (d: string, n: number) => day(d).add(n, "day").format(DATE),
	add_months: (d: string, n: number) => day(d).add(n, "month").format(DATE),
	str_to_obj: (d: string) => day(d).toDate(),
	obj_to_str: (d: Date) => dayjs(d).format(DATE),
};

/** Any missing property is a function returning another such stand-in. */
function noop(): unknown {
	const fn = () => noop();
	return new Proxy(fn, { get: (_, key) => (key === Symbol.toPrimitive ? () => "" : noop()) });
}

export function readFilters(script: string, reportName: string): ReportFilter[] {
	const queryReports: Record<string, { filters?: ReportFilter[] }> = {};
	const known: Record<string, unknown> = {
		query_reports: queryReports,
		datetime,
		defaults: {
			get_user_default: (key: string) =>
				key.toLowerCase() === "company" ? getBoot().company : undefined,
			get_default: (key: string) =>
				key.toLowerCase() === "company" ? getBoot().company : undefined,
		},
		session: { user: getBoot().user },
	};
	const frappe = new Proxy(known, { get: (t, key: string) => (key in t ? t[key] : noop()) });
	try {
		new Function("frappe", "__", "$", "erpnext", script)(
			frappe,
			(s: string) => s,
			noop(),
			noop(),
		);
	} catch {
		// a script that does more than define the report still gives us its filters
	}
	return (queryReports[reportName]?.filters ?? []).filter(
		(f) => f.fieldname && f.fieldtype !== "Break",
	);
}

export async function loadFilters(reportName: string): Promise<ReportFilter[]> {
	const res = await callMethod<{ script?: string }>(
		"frappe.desk.query_report.get_script",
		{ report_name: reportName },
		"GET",
	);
	return readFilters(res?.script ?? "", reportName);
}

/** Options of a Select filter as a list. */
export function selectOptions(options: ReportFilter["options"]): string[] {
	return (Array.isArray(options) ? options : String(options ?? "").split("\n")).filter(Boolean);
}
