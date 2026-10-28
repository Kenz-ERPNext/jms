// Create Expense and Payment Return: the same titles, fields, buttons, messages and
// Job methods as the ERPNext Job form's Create menu.

import { Form, Input, Typography } from "antd";

import LinkSelect from "@/components/LinkSelect";
import { apiFetch } from "@/lib/frappe";

import { runJobMethod } from "../api";
import {
	FULL_ROW,
	ModeOfPayment,
	MoneyField,
	PaySelect,
	PostingDate,
	Reference,
	TaxTemplate,
	toServer,
} from "../fields";
import { names, type JobAction } from "../types";

const required = (label: string) => [{ required: true, message: `${label} is required` }];

export const expense: JobAction = {
	title: "Create Expense",
	okText: "Submit",
	hint: "A cost for this job, e.g. a government fee paid to a supplier. Recorded as a purchase invoice.",
	initialValues: () => ({ payment_type: "Payment Now" }),
	Fields: ({ job }) => {
		const form = Form.useFormInstance();
		const payNow = Form.useWatch("payment_type") === "Payment Now";
		const setItem = async (type?: string) => {
			if (!type) return form.setFieldValue("item_code", undefined);
			const body = await apiFetch(`/api/resource/Expense Type/${encodeURIComponent(type)}`);
			form.setFieldValue("item_code", (body.data as { item?: string }).item);
		};
		return (
			<>
				<Form.Item
					name="expense_type"
					label="Expense Type"
					rules={required("Expense Type")}
				>
					<LinkSelect
						doctype="Expense Type"
						placeholder="Search expense type"
						onChange={(v) => setItem(v as string)}
					/>
				</Form.Item>
				<Form.Item
					name="item_code"
					hidden
					rules={[
						{
							required: true,
							message: "Item not set in Expense Type",
						},
					]}
				>
					<Input />
				</Form.Item>
				<Form.Item noStyle shouldUpdate>
					{() =>
						form.getFieldValue("expense_type") && !form.getFieldValue("item_code") ? (
							<Typography.Text type="danger" style={FULL_ROW}>
								Item not set in Expense Type
							</Typography.Text>
						) : null
					}
				</Form.Item>
				<MoneyField name="amount" label="Amount" />
				<Form.Item name="supplier" label="Supplier" rules={required("Supplier")}>
					<LinkSelect
						doctype="Supplier"
						labelField="supplier_name"
						placeholder="Search supplier"
					/>
				</Form.Item>
				<PaySelect name="payment_type" label="Payment Type" />
				{payNow && <ModeOfPayment />}
				{payNow && <Reference />}
				<TaxTemplate
					doctype="Purchase Taxes and Charges Template"
					company={job.company}
					name="taxes_template"
					label="Purchase Taxes and Charges Template"
				/>
				<PostingDate />
			</>
		);
	},
	submit: async (job, values) =>
		names(await runJobMethod(job.name, "create_expense", toServer(values))),
};

export const paymentReturn: JobAction = {
	title: "Create Payment Return",
	okText: "Create",
	hint: "Money we pay back to the customer for this job (payment return).",
	Fields: () => (
		<>
			<MoneyField name="amount" label="Amount" />
			<ModeOfPayment />
			<PostingDate />
		</>
	),
	submit: async (job, values) =>
		names(await runJobMethod(job.name, "create_payment_return", toServer(values))),
};
