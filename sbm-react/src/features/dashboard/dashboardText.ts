// Every label on the Dashboard in one place. Keys are the values the server sends
// (stage, status, money key, list key).

import { tokens } from "@/theme/tokens";

const { color } = tokens;

/** The four big numbers, in order. Expenses and outsourcing show under Net Profit. */
export const KPIS: { key: string; label: string; hint: string }[] = [
	{ key: "total_job_amount", label: "Job Value", hint: "All jobs, before VAT" },
	{ key: "total_received", label: "Received", hint: "Paid by customers, less refunds" },
	{
		key: "outstanding",
		label: "Still to Receive",
		hint: "Invoiced, not paid yet",
	},
	{ key: "net_profit", label: "Net Profit", hint: "After expenses and outsourcing" },
];

export const COST_LABELS: Record<string, string> = {
	total_expenses: "Expenses",
	outsourcing_cost: "Outsourcing",
};

export type ListKey = "to_invoice" | "to_collect" | "overdue";

export const ACTIONS: {
	key: ListKey;
	title: string;
	hint: string;
	empty: string;
	/** Which jobs the dashboard shows first (it shows only a few). */
	order: string;
	/** Jobs list tab with all of them. */
	tab: string;
	color: string;
}[] = [
	{
		key: "to_invoice",
		title: "Ready to invoice",
		hint: "Work done, no invoice yet",
		empty: "Every finished job is invoiced",
		order: "longest waiting",
		tab: "Invoice Pending",
		color: color.warning,
	},
	{
		key: "to_collect",
		title: "Waiting for payment",
		hint: "Invoiced, not paid in full",
		empty: "Nothing to collect",
		order: "biggest amounts",
		tab: "Amount Pending",
		color: color.info,
	},
	{
		key: "overdue",
		title: "Late jobs",
		hint: "Past the expected date",
		empty: "No late jobs",
		order: "latest",
		tab: "Overdue",
		color: color.danger,
	},
];

/** Stages of open jobs, in order, with what each means. */
export const STAGE_TEXT: Record<string, { hint: string; color: string }> = {
	"Processing Work": { hint: "Tasks being done", color: color.info },
	"Invoice Pending": { hint: "Work done, not invoiced", color: color.warning },
	"Amount Pending": { hint: "Invoiced, not paid", color: color.warning },
	"Exp Pending": { hint: "Supplier not paid", color: color.warning },
	Completed: { hint: "Settled, ready to close", color: color.success },
};
