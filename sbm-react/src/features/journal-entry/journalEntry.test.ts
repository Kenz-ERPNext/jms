import dayjs from "dayjs";
import { describe, expect, it } from "vitest";

import { fromDoc, partyTypeFor, toDoc, totals } from "./journalEntry";

describe("journal entry", () => {
	const values = {
		voucher_type: "Journal Entry",
		posting_date: dayjs("2026-11-07"),
		user_remark: "",
		accounts: [
			{ account: "1201 - Jeddah - O", debit: 100.1, credit: null },
			{
				account: "1310 - Debtors - O",
				party_type: "Customer",
				party: "Oasis",
				job: "JOB-1/26",
				credit: 100.1,
			},
			{ debit: 5 }, // no account: left out
		],
	};

	it("totals debit and credit", () => {
		expect(totals(values.accounts)).toEqual({ debit: 105.1, credit: 100.1, difference: 5 });
	});

	it("builds the document, with amounts in account currency and the default cost center", () => {
		const doc = toDoc(values, {
			company: "Oasis",
			costCenter: "Main - O",
			amendedFrom: "ACC-JV-1",
			submit: true,
		});
		expect(doc).toMatchObject({
			doctype: "Journal Entry",
			company: "Oasis",
			posting_date: "2026-11-07",
			amended_from: "ACC-JV-1",
			docstatus: 1,
			user_remark: undefined,
		});
		expect(doc.accounts).toEqual([
			{
				account: "1201 - Jeddah - O",
				party_type: undefined,
				party: undefined,
				job: undefined,
				cost_center: "Main - O",
				debit_in_account_currency: 100.1,
				credit_in_account_currency: 0,
			},
			{
				account: "1310 - Debtors - O",
				party_type: "Customer",
				party: "Oasis",
				job: "JOB-1/26",
				cost_center: "Main - O",
				debit_in_account_currency: 0,
				credit_in_account_currency: 100.1,
			},
		]);
	});

	it("reads a cancelled entry back for its amendment", () => {
		const back = fromDoc({
			voucher_type: "Bank Entry",
			posting_date: "2026-11-01",
			cheque_no: "99",
			accounts: [
				{
					account: "A",
					debit_in_account_currency: 10,
					credit_in_account_currency: 0,
					job: "J",
				},
			],
		});
		expect(back.voucher_type).toBe("Bank Entry");
		expect(back.posting_date.format("YYYY-MM-DD")).toBe("2026-11-01");
		expect(back.accounts[0]).toMatchObject({
			account: "A",
			debit: 10,
			credit: null,
			job: "J",
		});
	});

	it("sets the party type from the account type", () => {
		expect(partyTypeFor("Receivable")).toBe("Customer");
		expect(partyTypeFor("Payable")).toBe("Supplier");
		expect(partyTypeFor("Bank")).toBeUndefined();
	});
});
