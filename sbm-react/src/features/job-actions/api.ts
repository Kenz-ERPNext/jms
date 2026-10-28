// Calls the Job's own methods, the same ones the ERPNext Job form's Create buttons
// call (create_invoice, create_expense, ...), through Frappe's run_doc_method.

import { apiFetch } from "@/lib/frappe";

export async function runJobMethod<T = unknown>(
	job: string,
	method: string,
	args: Record<string, unknown> = {},
): Promise<T> {
	const body = await apiFetch("/api/method/run_doc_method", {
		method: "POST",
		body: { dt: "Job", dn: job, method, args: JSON.stringify(args) },
	});
	return body.message as T;
}

export interface OpenInvoice {
	name: string;
	posting_date: string;
	grand_total: number;
	outstanding_amount: number;
	party: string;
}

export const openInvoices = (job: string, type: "Sales Invoice" | "Purchase Invoice") =>
	runJobMethod<OpenInvoice[]>(job, "get_job_open_invoices", { invoice_type: type });

/** Spread an amount over invoices, oldest first (as the ERPNext dialogs do). */
export function allocate(amount: number, invoices: OpenInvoice[]) {
	let left = amount;
	const rows: { invoice: string; allocated_amount: number }[] = [];
	for (const inv of invoices) {
		if (left <= 0) break;
		const part = Math.min(inv.outstanding_amount, left);
		if (part > 0) rows.push({ invoice: inv.name, allocated_amount: part });
		left = Math.round((left - part) * 100) / 100;
	}
	return { rows, leftOver: left };
}

/** Default tax template, as ERPNext: one named "VAT 0", else the default, else the first. */
export function defaultTemplate(
	templates: { name: string; title?: string; is_default?: number }[],
) {
	const vat0 = templates.find((t) => `${t.title} ${t.name}`.toLowerCase().includes("vat 0"));
	return (vat0 ?? templates.find((t) => t.is_default) ?? templates[0])?.name;
}
