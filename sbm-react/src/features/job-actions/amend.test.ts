import dayjs from "dayjs";
import { describe, expect, it } from "vitest";

import { amendAction, amendValues, type Doc } from "./amend";

const pe = (payment_type: string, party_type: string): Doc => ({
	doctype: "Payment Entry",
	name: "PE-1",
	payment_type,
	party_type,
	party: "Acme",
	paid_amount: 500,
	mode_of_payment: "Cash",
	reference_no: "R1",
	reference_date: "2026-10-01",
	posting_date: "2026-10-02",
});

describe("amendAction", () => {
	it("is the form that makes that kind of document", () => {
		expect(amendAction({ doctype: "Sales Invoice", name: "S" })).toBe("sales_invoice");
		expect(
			amendAction({
				doctype: "Purchase Invoice",
				name: "P",
				items: [{ expense_type: "Fee" }],
			}),
		).toBe("expense");
		expect(amendAction({ doctype: "Purchase Invoice", name: "P", items: [{}] })).toBe(
			"purchase_invoice",
		);
		expect(amendAction(pe("Receive", "Customer"))).toBe("advance_receipt");
		expect(amendAction(pe("Pay", "Customer"))).toBe("payment_return");
		expect(amendAction(pe("Receive", "Supplier"))).toBe("expense_return");
		expect(amendAction(pe("Pay", "Supplier"))).toBe("outsource_advance");
		expect(amendAction(pe("Internal Transfer", ""))).toBeUndefined();
		expect(amendAction({ doctype: "Journal Entry", name: "J" })).toBeUndefined();
	});
});

describe("amendValues", () => {
	it("fills a payment form from the payment", () => {
		const v = amendValues("outsource_advance", pe("Pay", "Supplier"));
		expect(v.suppliers).toEqual([{ supplier: "Acme", advance_amount: 500 }]);
		expect(v.mode_of_payment).toBe("Cash");
		expect(v.reference_no).toBe("R1");
		expect(dayjs.isDayjs(v.posting_date) && v.posting_date.format("YYYY-MM-DD")).toBe(
			"2026-10-02",
		);
		expect(amendValues("expense_return", pe("Receive", "Supplier"))).toMatchObject({
			supplier: "Acme",
			amount: 500,
		});
	});

	it("brings an invoice back on Credit, its old payment being an advance now", () => {
		const pi: Doc = {
			doctype: "Purchase Invoice",
			name: "P",
			supplier: "Gov",
			taxes_and_charges: "VAT 0",
			posting_date: "2026-10-02",
			items: [{ expense_type: "Fee", item_code: "FEE", rate: 75 }],
		};
		expect(amendValues("expense", pi)).toMatchObject({
			expense_type: "Fee",
			item_code: "FEE",
			amount: 75,
			supplier: "Gov",
			taxes_template: "VAT 0",
			payment_type: "Credit",
		});
		expect(amendValues("sales_invoice", { doctype: "Sales Invoice", name: "S" }).payment).toBe(
			"Credit",
		);
	});
});
