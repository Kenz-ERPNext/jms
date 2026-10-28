// Shapes of the Job form: only the fields the modal edits. Other fields of a table
// row are kept when saving (see useJobForm).

export interface ServiceRow {
	name?: string;
	work_template?: string;
	description?: string;
	item_code?: string;
	job_qty?: number;
	fee_price?: number;
	old_fee_price?: number;
	extra?: number;
	surcharge?: number;
	vat?: number;
}

export interface TaskRow {
	name?: string;
	task_name?: string;
	employee__outsource?: "Employee" | "Outsource";
	assigned_to?: string;
	assigned_tos?: string;
	outsource_charge?: number;
	status?: string;
	pending_reason?: string;
	work_template?: string;
	item_code?: string;
	due_date?: string;
	linked_task?: string;
}

export interface JobFormValues {
	job_title?: string;
	customer?: string;
	receivable_from?: "Customer" | "Agent";
	agent?: string;
	job_type?: string;
	job_source?: string;
	items: ServiceRow[];
	tasks: TaskRow[];
}

export const TASK_STATUSES = ["Open", "In Progress", "Pending", "Completed", "Cancelled"];

/** Line total as the server works it out: (fee + extra + surcharge) × qty, plus VAT. */
export function lineTotal(row: ServiceRow): number {
	const base =
		((row.fee_price ?? 0) + (row.extra ?? 0) + (row.surcharge ?? 0)) * (row.job_qty || 1);
	return base + (base * (row.vat ?? 0)) / 100;
}
