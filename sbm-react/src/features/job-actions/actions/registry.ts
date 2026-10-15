// Every job action form, by the action key the server sends (get_job_state).
// A new action is one entry here plus its form.

import type { JobAction } from "../types";

import { advanceReceipt, expenseReturn, salesInvoice } from "./moneyIn";
import { expense, paymentReturn } from "./moneyOut";
import { outsourceAdvance, purchaseInvoice } from "./outsource";

export const JOB_ACTIONS: Record<string, JobAction> = {
	advance_receipt: advanceReceipt,
	sales_invoice: salesInvoice,
	expense_return: expenseReturn,
	purchase_invoice: purchaseInvoice,
	outsource_advance: outsourceAdvance,
	expense,
	payment_return: paymentReturn,
};
