// Jobs list state lives in the URL (tab, search, filters, page), so a link from the
// Dashboard opens the right list and the browser Back button works.

import { useCustom } from "@refinedev/core";
import { useSearchParams } from "react-router";

import { getBoot } from "@/lib/boot";

export interface JobListRow {
	name: string;
	job_title?: string;
	customer?: string;
	customer_name?: string;
	job_type?: string;
	status: string;
	priority?: string;
	stage: string;
	net_amount: number;
	to_collect: number;
	to_pay: number;
	start_date?: string;
	expected_completion_date?: string;
	overdue: boolean;
	tasks_total: number;
	tasks_done: number;
}

interface JobsResponse {
	jobs: JobListRow[];
	total: number;
	tab_counts: Record<string, number>;
}

/** URL keys of the filters; the same names as list_jobs takes. */
export const FILTERS = [
	"customer",
	"agent",
	"job_type",
	"status",
	"priority",
	"from_date",
	"to_date",
] as const;
export type FilterKey = (typeof FILTERS)[number];

const PAGE_SIZE = 10;

export function useJobsList() {
	const [params, setParams] = useSearchParams();
	const value = (key: string) => params.get(key) || undefined;
	const page = Math.max(Number(params.get("page")) || 1, 1);
	const pageSize = Number(params.get("size")) || PAGE_SIZE;

	const { query } = useCustom<JobsResponse>({
		url: "jms.api.jobs.list_jobs",
		method: "get",
		config: {
			query: {
				tab: value("tab"),
				search: value("q"),
				company: getBoot().company,
				...Object.fromEntries(FILTERS.map((key) => [key, value(key)])),
				start: (page - 1) * pageSize,
				page_length: pageSize,
			},
		},
	});

	/** Change some URL keys (empty = remove). Any change but the page goes to page 1. */
	const update = (changes: Record<string, string | number | undefined>) =>
		setParams((prev) => {
			const next = new URLSearchParams(prev);
			for (const [key, v] of Object.entries(changes)) {
				if (v === undefined || v === "") next.delete(key);
				else next.set(key, String(v));
			}
			if (!("page" in changes)) next.delete("page");
			return next;
		});

	const filters = Object.fromEntries(FILTERS.map((key) => [key, value(key)])) as Record<
		FilterKey,
		string | undefined
	>;

	return {
		tab: value("tab") ?? "",
		search: value("q") ?? "",
		filters,
		activeFilters: FILTERS.filter((key) => filters[key]).length,
		page,
		pageSize,
		// Not result.data: Refine gives {} there until the call has returned.
		data: query.data?.data,
		isLoading: query.isFetching,
		error: query.error,
		update,
		clearFilters: () => update(Object.fromEntries(FILTERS.map((key) => [key, undefined]))),
	};
}
