// A Journal Entry between the React form and ERPNext: the form's values as the
// document to insert (save as draft or submit), and a cancelled entry's values for
// its amendment. Amounts go in the account currency fields, which ERPNext converts.

import dayjs, { type Dayjs } from "dayjs";

export interface JeRow {
	account?: string;
	party_type?: string;
	party?: string;
	job?: string;
	cost_center?: string;
	debit?: number | null;
	credit?: number | null;
}

export interface JeValues {
	voucher_type: string;
	posting_date: Dayjs;
	cheque_no?: string;
	cheque_date?: Dayjs;
	user_remark?: string;
	accounts: JeRow[];
}

export const VOUCHER_TYPES = [
	"Journal Entry",
	"Bank Entry",
	"Cash Entry",
	"Credit Card Entry",
	"Contra Entry",
	"Debit Note",
	"Credit Note",
	"Write Off Entry",
	"Opening Entry",
];

/** Voucher types that need a reference number and date, as in ERPNext. */
export const NEEDS_REFERENCE = ["Bank Entry"];

export const PARTY_TYPES = ["Customer", "Supplier", "Employee"];

/** The party type an account's type asks for (a receivable is a customer's). */
export function partyTypeFor(accountType?: string): string | undefined {
	if (accountType === "Receivable") return "Customer";
	if (accountType === "Payable") return "Supplier";
	return undefined;
}

const round = (n: number) => Math.round(n * 100) / 100;

export function totals(rows: JeRow[] = []) {
	const debit = round(rows.reduce((s, r) => s + (Number(r?.debit) || 0), 0));
	const credit = round(rows.reduce((s, r) => s + (Number(r?.credit) || 0), 0));
	return { debit, credit, difference: round(debit - credit) };
}

const day = (d?: Dayjs) => (d ? d.format("YYYY-MM-DD") : undefined);

export function toDoc(
	values: JeValues,
	opts: { company?: string; costCenter?: string; amendedFrom?: string; submit: boolean },
): Record<string, unknown> {
	return {
		doctype: "Journal Entry",
		company: opts.company,
		voucher_type: values.voucher_type,
		posting_date: day(values.posting_date),
		cheque_no: values.cheque_no || undefined,
		cheque_date: day(values.cheque_date),
		user_remark: values.user_remark || undefined,
		amended_from: opts.amendedFrom,
		docstatus: opts.submit ? 1 : 0,
		accounts: values.accounts
			.filter((r) => r?.account)
			.map((r) => ({
				account: r.account,
				party_type: r.party ? r.party_type : undefined,
				party: r.party || undefined,
				job: r.job || undefined,
				cost_center: r.cost_center || opts.costCenter,
				debit_in_account_currency: Number(r.debit) || 0,
				credit_in_account_currency: Number(r.credit) || 0,
			})),
	};
}

/** A cancelled entry's values, for the form that makes its amendment. */
export function fromDoc(doc: Record<string, unknown>): JeValues {
	const rows = (doc.accounts as Record<string, unknown>[]) ?? [];
	const date = (v: unknown) => (v ? dayjs(String(v)) : undefined);
	return {
		voucher_type: String(doc.voucher_type ?? "Journal Entry"),
		posting_date: date(doc.posting_date) ?? dayjs(),
		cheque_no: (doc.cheque_no as string) || undefined,
		cheque_date: date(doc.cheque_date),
		user_remark: (doc.user_remark as string) || undefined,
		accounts: rows.map((r) => ({
			account: r.account as string,
			party_type: (r.party_type as string) || undefined,
			party: (r.party as string) || undefined,
			job: (r.job as string) || undefined,
			cost_center: (r.cost_center as string) || undefined,
			debit: Number(r.debit_in_account_currency) || null,
			credit: Number(r.credit_in_account_currency) || null,
		})),
	};
}
