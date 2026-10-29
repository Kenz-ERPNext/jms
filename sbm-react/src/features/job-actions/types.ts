// What a job action form is: a title, its fields, and how its values become a call
// to the Job method. Every action form follows this shape (actions/registry.ts).

import type { ComponentType } from "react";

/** The parts of the Job the action forms need. */
export interface ActionJob {
	name: string;
	company?: string;
	items: { total_without_tax?: number }[];
	tasks: {
		employee__outsource?: string;
		outsource_supplier?: string;
		purchase_invoice?: string;
	}[];
}

export type Values = Record<string, unknown>;

/** The cancelled document an action's new one amends. */
export interface AmendOf {
	doctype: string;
	name: string;
}

export interface JobAction {
	title: string;
	okText: string;
	/** One line under the title: what the action records. */
	hint: string;
	Fields: ComponentType<{ job: ActionJob }>;
	initialValues?: (job: ActionJob) => Values;
	/** A message instead of the form when the action cannot be done (as ERPNext says it). */
	blocked?: (job: ActionJob) => Promise<string | undefined>;
	/** Calls the Job method; returns the names of the documents made. With `amend`,
	 * the new document of that DocType is the amendment of the cancelled one. */
	submit: (job: ActionJob, values: Values, amend?: AmendOf) => Promise<string[]>;
}

/** Suppliers of the job's outsourced tasks (all, or only those without an invoice). */
export function outsourceSuppliers(job: ActionJob, unbilledOnly = false): string[] {
	const rows = job.tasks.filter(
		(t) =>
			t.employee__outsource === "Outsource" &&
			t.outsource_supplier &&
			(!unbilledOnly || !t.purchase_invoice),
	);
	return [...new Set(rows.map((t) => t.outsource_supplier!))];
}

/** A method may return one name or a list of names. */
export const names = (result: unknown): string[] =>
	(Array.isArray(result) ? result : [result]).filter(Boolean).map(String);
