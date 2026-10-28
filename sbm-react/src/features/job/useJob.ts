// Data of one Job page: the Job document and its state from the server (stage,
// next step, allowed actions, money). The name comes from the URL after /jobs/.

import { useCustom, useOne } from "@refinedev/core";
import { useParams } from "react-router";

export interface JobTask {
	name: string;
	idx: number;
	task_name?: string;
	employee__outsource?: string;
	assigned_to?: string;
	assigned_tos?: string;
	outsource_supplier?: string;
	outsource_charge?: number;
	due_date?: string;
	completion_date?: string;
	status?: string;
	priority?: string;
	pending_reason?: string;
	purchase_invoice?: string;
}

export interface JobItem {
	name: string;
	work_template?: string;
	description?: string;
	item_code?: string;
	job_qty?: number;
	fee_price?: number;
	extra?: number;
	surcharge?: number;
	vat?: number;
	total?: number;
}

export interface JobDoc {
	name: string;
	job_title?: string;
	status: string;
	priority?: string;
	customer?: string;
	customer_name?: string;
	customer_mobile?: string;
	agent?: string;
	receivable_from?: string;
	job_type?: string;
	job_nature?: string;
	job_source?: string;
	date?: string;
	start_date?: string;
	expected_completion_date?: string;
	completion_date?: string;
	closing_date?: string;
	overdue_status?: string;
	gross_amount?: number;
	discount?: number;
	net_amount?: number;
	notes?: string;
	company?: string;
	items: JobItem[];
	tasks: JobTask[];
	documents: {
		name: string;
		document_type?: string;
		is_received?: number;
		received_date?: string;
		attachment?: string;
	}[];
}

export interface Metric {
	key: string;
	label: string;
	value: number;
	visible: boolean;
}

export interface JobState {
	stage: string;
	next_action: string | null;
	actions: { key: string; method: string | null }[];
	financials: { currency?: string; metrics: Metric[]; has_sales_invoice: boolean };
}

export function useJobName(): string {
	return useParams()["*"] ?? "";
}

export function useJob(name: string) {
	const doc = useOne<JobDoc>({ resource: "Job", id: name, queryOptions: { enabled: !!name } });
	const state = useCustom<JobState>({
		url: "jms.api.job_state.get_job_state",
		method: "get",
		config: { query: { job: name } },
		queryOptions: { enabled: !!name },
	});
	return {
		// Not result: Refine gives an empty value there until the call has returned.
		job: doc.query.data?.data,
		state: state.query.data?.data,
		isLoading: doc.query.isLoading || state.query.isLoading,
		error: doc.query.error ?? state.query.error,
		refetch: () => Promise.all([doc.query.refetch(), state.query.refetch()]),
	};
}
