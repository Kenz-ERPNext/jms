// Dashboard data: one call to jms.api.home.get_dashboard for the user's company.

import { useCustom } from "@refinedev/core";

import { getBoot } from "@/lib/boot";

export interface StepCount {
	label: string;
	count: number;
}

export interface JobRow {
	name: string;
	job_title?: string;
	customer_name?: string;
	status: string;
	stage: string;
	net_amount: number;
	to_collect: number;
	expected_completion_date?: string;
	tasks_total: number;
	tasks_done: number;
}

export interface JobList {
	total: number;
	/** Sum of the list's money column over all its jobs (null when it has none). */
	amount: number | null;
	rows: JobRow[];
}

export interface MonthRow {
	month: string;
	jobs: number;
	/** null when JMS Settings hides money received */
	received: number | null;
}

export interface Dashboard {
	lifecycle: StepCount[];
	stages: StepCount[];
	money: { key: string; value: number }[];
	to_invoice: JobList;
	to_collect: JobList;
	overdue: JobList;
	monthly: MonthRow[];
	/** Set when the site is missing setup the money totals need. */
	setup_needed?: "job_dimension" | null;
}

export function useDashboard() {
	const { query } = useCustom<Dashboard>({
		url: "jms.api.home.get_dashboard",
		method: "get",
		config: { query: { company: getBoot().company } },
	});
	return {
		// Not result.data: Refine gives {} there until the call has returned.
		data: query.data?.data,
		isLoading: query.isLoading,
		error: query.error,
		refetch: query.refetch,
	};
}
