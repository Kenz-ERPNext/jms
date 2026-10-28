// The Activity Log rows for the chosen filters, newest first, a page at a time,
// read from the Accounting Change Log with the standard list API. Refreshed every
// 15 seconds, so new changes show up on their own.

import { useList, type CrudFilter } from "@refinedev/core";

import type { LogRow } from "./ActivityItem";

export interface LogFilters {
	search?: string;
	action?: string;
	doctype?: string;
	user?: string;
	/** YYYY-MM-DD: changes on or after this day. */
	fromDate?: string;
}

export const PAGE_SIZE = 15;

const eq = (field: string, value?: string): CrudFilter[] =>
	value ? [{ field, operator: "eq", value }] : [];

export function useActivityLog(f: LogFilters, page: number) {
	const filters: CrudFilter[] = [
		...eq("action", f.action),
		...eq("reference_doctype", f.doctype),
		...eq("changed_by", f.user),
		...(f.fromDate
			? [{ field: "creation", operator: "gte" as const, value: f.fromDate }]
			: []),
		...(f.search
			? [
					{
						operator: "or" as const,
						value: ["reference_name", "job", "party"].map((field) => ({
							field,
							operator: "contains" as const,
							value: f.search,
						})),
					},
				]
			: []),
	];
	const { query } = useList<LogRow>({
		resource: "Accounting Change Log",
		filters,
		sorters: [{ field: "creation", order: "desc" }],
		pagination: { currentPage: page, pageSize: PAGE_SIZE },
		// "live": look for new changes every 15 seconds while the page is open
		queryOptions: { refetchInterval: 15_000 },
		meta: {
			fields: [
				"name",
				"creation",
				"action",
				"reference_doctype",
				"reference_name",
				"job",
				"party",
				"amount",
				"changed_by_name",
				"details",
			],
		},
	});
	return {
		rows: query.data?.data ?? [],
		total: query.data?.total ?? 0,
		loading: query.isLoading,
	};
}
