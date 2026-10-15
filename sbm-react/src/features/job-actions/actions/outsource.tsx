// Create Purchase Invoice and Outsource Advance Payment (the outsourced tasks): the
// same titles, fields, buttons, messages and Job methods as the ERPNext Job form.

import { Form, Input, InputNumber, Select, Space } from "antd";

import { allocate, openInvoices, runJobMethod } from "../api";
import {
	FULL_ROW,
	ModeOfPayment,
	PaySelect,
	PostingDate,
	Reference,
	TaxTemplate,
	toServer,
} from "../fields";
import { names, outsourceSuppliers, type JobAction } from "../types";

const required = (label: string) => [{ required: true, message: `${label} is required` }];

export const purchaseInvoice: JobAction = {
	title: "Create Purchase Invoice",
	okText: "Create",
	hint: "Bills from the outside party for their tasks on this job (the tasks' charges).",
	initialValues: (job) => ({ payment_pi: "Credit", supplier: outsourceSuppliers(job, true)[0] }),
	// ERPNext checks this when the button is clicked
	blocked: async (job) =>
		outsourceSuppliers(job, true).length
			? undefined
			: "No unbilled outsource tasks found. All Purchase Invoices have been created.",
	Fields: ({ job }) => {
		const payNow = Form.useWatch("payment_pi") === "Payment Now";
		return (
			<>
				<Form.Item name="supplier" label="Select Supplier" rules={required("Supplier")}>
					<Select
						options={outsourceSuppliers(job, true).map((s) => ({
							value: s,
							label: s,
						}))}
					/>
				</Form.Item>
				<PostingDate />
				<TaxTemplate
					doctype="Purchase Taxes and Charges Template"
					company={job.company}
					name="tax_template"
					label="Taxes and Charges Template"
				/>
				<PaySelect name="payment_pi" label="Payment" />
				{payNow && (
					<>
						<ModeOfPayment name="mode_of_payment_pi" />
						<Reference />
					</>
				)}
			</>
		);
	},
	submit: async (job, values) =>
		names(await runJobMethod(job.name, "create_pinvoice", toServer(values))),
};

export const outsourceAdvance: JobAction = {
	title: "Create Outsource Advance Payment",
	okText: "Create",
	hint: "Advance to the outside parties of this job. Applied to their open purchase invoices first.",
	initialValues: (job) => ({
		suppliers: outsourceSuppliers(job).map((supplier) => ({ supplier })),
	}),
	Fields: () => (
		<>
			<div style={FULL_ROW}>
				<Form.List name="suppliers">
					{(fields) =>
						fields.map((f) => (
							<Space key={f.key} style={{ display: "flex" }} align="baseline">
								<Form.Item
									name={[f.name, "supplier"]}
									label={f.name === 0 ? "Supplier" : ""}
								>
									<Input readOnly variant="borderless" />
								</Form.Item>
								<Form.Item
									name={[f.name, "advance_amount"]}
									label={f.name === 0 ? "Advance Amount" : ""}
								>
									<InputNumber min={0} placeholder="0" />
								</Form.Item>
							</Space>
						))
					}
				</Form.List>
			</div>
			<ModeOfPayment />
			<PostingDate />
		</>
	),
	submit: async (job, values) => {
		const v = toServer(values);
		const rows = (
			(v.suppliers as { supplier: string; advance_amount?: number }[]) ?? []
		).filter((r) => (r.advance_amount ?? 0) > 0);
		if (!rows.length) throw new Error("Please enter at least one advance amount");
		const open = await openInvoices(job.name, "Purchase Invoice");
		const suppliers = rows.map((r) => ({
			...r,
			allocations: allocate(
				r.advance_amount!,
				open.filter((i) => i.party === r.supplier),
			).rows,
		}));
		return names(
			await runJobMethod(job.name, "create_outsource_advance_payment", { ...v, suppliers }),
		);
	},
};
