// Which Create form amends a cancelled document, and that form's values taken from it.
// A Payment Entry is told apart by who paid whom; a "Payment Now" payment made with
// an invoice goes through Advance Receipt / Outsource Advance too, which apply it to
// the open invoices. A Purchase Invoice whose item is an Expense Type's item is an
// expense (docAmend.tsx looks the Expense Type up into the item's expense_type, which
// the invoice itself does not keep), else the outsourced tasks' invoice.

import dayjs from "dayjs";

import type { Values } from "./types";

export type Doc = Record<string, unknown> & {
	doctype: string;
	name: string;
	items?: Record<string, unknown>[];
};

/** The action key (actions/registry.ts) of the form that makes this kind of document. */
export function amendAction(doc: Doc): string | undefined {
	if (doc.doctype === "Sales Invoice") return "sales_invoice";
	if (doc.doctype === "Purchase Invoice") {
		return doc.items?.some((i) => i.expense_type) ? "expense" : "purchase_invoice";
	}
	if (doc.doctype === "Payment Entry") {
		const key = `${doc.payment_type}/${doc.party_type}`;
		return {
			"Receive/Customer": "advance_receipt",
			"Pay/Customer": "payment_return",
			"Receive/Supplier": "expense_return",
			"Pay/Supplier": "outsource_advance",
		}[key];
	}
	return undefined;
}

const date = (v: unknown) => (v ? dayjs(String(v)) : undefined);

/** The form's values from the cancelled document. An invoice comes back on Credit:
 * cancelling it unlinked its payment, which stays as an advance and is applied again. */
export function amendValues(action: string, doc: Doc): Values {
	const payment = {
		mode_of_payment: doc.mode_of_payment,
		reference_no: doc.reference_no,
		reference_date: date(doc.reference_date),
		posting_date: date(doc.posting_date),
	};
	const item = doc.items?.[0] ?? {};
	switch (action) {
		case "sales_invoice":
			return {
				posting_date: date(doc.posting_date),
				tax_template: doc.taxes_and_charges,
				payment: "Credit",
			};
		case "purchase_invoice":
			return {
				supplier: doc.supplier,
				posting_date: date(doc.posting_date),
				tax_template: doc.taxes_and_charges,
				payment_pi: "Credit",
			};
		case "expense":
			return {
				expense_type: item.expense_type,
				item_code: item.item_code,
				amount: item.rate,
				supplier: doc.supplier,
				taxes_template: doc.taxes_and_charges,
				payment_type: "Credit",
				posting_date: date(doc.posting_date),
			};
		case "advance_receipt":
		case "payment_return":
			return { ...payment, amount: doc.paid_amount };
		case "expense_return":
			return { ...payment, supplier: doc.party, amount: doc.paid_amount };
		case "outsource_advance":
			return {
				...payment,
				suppliers: [{ supplier: doc.party, advance_amount: doc.paid_amount }],
			};
		default:
			return {};
	}
}
