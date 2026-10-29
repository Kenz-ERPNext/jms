// Advance Receipt, Create Sales Invoice and Expense Return: the same titles, fields,
// buttons, messages and Job methods as the ERPNext Job form's Create menu.

import { Alert, Form } from "antd";

import FocusSelect from "@/components/FocusSelect";
import LinkSelect from "@/components/LinkSelect";
import { apiFetch } from "@/lib/frappe";
import { formatMoney } from "@/lib/format";
import { tokens } from "@/theme/tokens";

import { allocate, openInvoices, runJobMethod } from "../api";
import AllocationPreview from "../AllocationPreview";
import {
	ModeOfPayment,
	MoneyField,
	PaySelect,
	PostingDate,
	Reference,
	FULL_ROW,
	TaxTemplate,
	toServer,
} from "../fields";
import { names, type JobAction } from "../types";

export const advanceReceipt: JobAction = {
	title: "Create Advance Receipt",
	okText: "Create",
	hint: "Money received from the customer. It is applied to the job's open sales invoices, oldest first; the rest stays as an advance.",
	Fields: ({ job }) => (
		<>
			<MoneyField name="amount" label="Advance Amount" />
			<AllocationPreview job={job.name} type="Sales Invoice" />
			<ModeOfPayment />
			<Reference />
			<PostingDate />
		</>
	),
	submit: async (job, values, amend) => {
		const v = toServer(values);
		const { rows } = allocate(Number(v.amount), await openInvoices(job.name, "Sales Invoice"));
		return names(
			await runJobMethod(
				job.name,
				"create_advance_receipt",
				{ ...v, allocations: rows },
				amend,
			),
		);
	},
};

const invoiceTotal = (job: { items: { total_without_tax?: number }[] }) =>
	job.items.reduce((sum, i) => sum + (i.total_without_tax ?? 0), 0);

export const salesInvoice: JobAction = {
	title: "Create Invoice & Payment",
	okText: "Submit",
	hint: "Bills the customer for the job's services. Advances already received are applied.",
	initialValues: () => ({ payment: "Payment Now", payment_type: "Full Paid" }),
	// ERPNext checks this when the button is clicked
	blocked: async (job) => {
		const body = await apiFetch("/api/method/frappe.client.get_count", {
			query: { doctype: "Sales Invoice", filters: { job: job.name, docstatus: 1 } },
		});
		return Number(body.message) > 0
			? "Sales Invoice already created for this Job."
			: undefined;
	},
	Fields: ({ job }) => {
		const payNow = Form.useWatch("payment") === "Payment Now";
		const partial = Form.useWatch("payment_type") === "Partially Paid";
		return (
			<>
				<Alert
					style={{ ...FULL_ROW, marginBottom: tokens.space.md }}
					type="info"
					showIcon
					message={`Total Invoice Amount: ${formatMoney(invoiceTotal(job))}`}
				/>
				<PostingDate />
				<TaxTemplate
					doctype="Sales Taxes and Charges Template"
					company={job.company}
					name="tax_template"
					label="Sales Taxes and Charges Template"
				/>
				<PaySelect name="payment" label="Payment" />
				{payNow && (
					<>
						<ModeOfPayment />
						<Form.Item name="payment_type" label="Payment Type">
							<FocusSelect
								options={["Full Paid", "Partially Paid"].map((v) => ({
									value: v,
									label: v,
								}))}
							/>
						</Form.Item>
						{partial && <MoneyField name="partial_amount" label="Partial Amount" />}
						<Reference />
					</>
				)}
			</>
		);
	},
	submit: async (job, values, amend) => {
		const v = toServer(values);
		if (v.payment === "Payment Now" && v.payment_type === "Partially Paid") {
			const paid = Number(v.partial_amount);
			if (!(paid > 0)) throw new Error("Please enter Partial Amount");
			if (paid > invoiceTotal(job))
				throw new Error("Partial amount cannot exceed Invoice Total");
		}
		return names(
			await runJobMethod(
				job.name,
				"create_invoice",
				{
					...v,
					partial_amount: v.partial_amount ?? 0,
				},
				amend,
			),
		);
	},
};

export const expenseReturn: JobAction = {
	title: "Create Expense Return",
	okText: "Create",
	hint: "Money a supplier paid back to us for this job.",
	Fields: () => (
		<>
			<Form.Item
				name="supplier"
				label="Supplier"
				rules={[{ required: true, message: "Supplier is required" }]}
			>
				<LinkSelect
					doctype="Supplier"
					labelField="supplier_name"
					placeholder="Search supplier"
				/>
			</Form.Item>
			<MoneyField name="amount" label="Amount" />
			<ModeOfPayment />
			<PostingDate />
		</>
	),
	submit: async (job, values, amend) =>
		names(await runJobMethod(job.name, "create_expense_return", toServer(values), amend)),
};
