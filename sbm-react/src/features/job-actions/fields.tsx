// Form fields the job action forms share: mode of payment, dates, references,
// money amounts, a tax template list for the job's company.

import { useList } from "@refinedev/core";
import { DatePicker, Form, Input, InputNumber } from "antd";
import dayjs from "dayjs";
import { useEffect } from "react";

import FocusSelect from "@/components/FocusSelect";
import LinkSelect from "@/components/LinkSelect";

import { defaultTemplate } from "./api";

/** The action forms lay fields out in columns; this takes a whole row. */
export const FULL_ROW = { gridColumn: "1 / -1" };

const required = (label: string) => [{ required: true, message: `${label} is required` }];

export function MoneyField({
	name,
	label,
	optional,
}: {
	name: string;
	label: string;
	optional?: boolean;
}) {
	return (
		<Form.Item name={name} label={label} rules={optional ? [] : required(label)}>
			<InputNumber min={0} style={{ width: "100%" }} />
		</Form.Item>
	);
}

export function ModeOfPayment({
	name = "mode_of_payment",
	optional,
}: {
	name?: string;
	optional?: boolean;
}) {
	return (
		<Form.Item
			name={name}
			label="Mode of Payment"
			rules={optional ? [] : required("Mode of Payment")}
		>
			<LinkSelect doctype="Mode of Payment" placeholder="Cash, bank, ..." />
		</Form.Item>
	);
}

export function PostingDate() {
	return (
		<Form.Item
			name="posting_date"
			label="Posting Date"
			initialValue={dayjs()}
			rules={required("Posting Date")}
		>
			<DatePicker style={{ width: "100%" }} format="DD-MM-YYYY" />
		</Form.Item>
	);
}

export function Reference() {
	return (
		<>
			<Form.Item name="reference_no" label="Reference No">
				<Input placeholder="Cheque / transfer no" />
			</Form.Item>
			<Form.Item name="reference_date" label="Reference Date">
				<DatePicker style={{ width: "100%" }} format="DD-MM-YYYY" />
			</Form.Item>
		</>
	);
}

export function PaySelect({ name, label = "Payment" }: { name: string; label?: string }) {
	return (
		<Form.Item name={name} label={label} rules={required(label)}>
			<FocusSelect
				options={["Payment Now", "Credit"].map((v) => ({ value: v, label: v }))}
			/>
		</Form.Item>
	);
}

/** Tax template of the given kind for the company; picks the ERPNext default. */
export function TaxTemplate({
	doctype,
	company,
	name,
	label,
}: {
	doctype: string;
	company?: string;
	name: string;
	/** As on the ERPNext dialog. */
	label: string;
}) {
	const form = Form.useFormInstance();
	const { query } = useList({
		resource: doctype,
		filters: company ? [{ field: "company", operator: "eq", value: company }] : [],
		pagination: { mode: "off" },
		meta: { fields: ["name", "title", "is_default"] },
	});
	const templates = query.data?.data;
	useEffect(() => {
		if (templates?.length && !form.getFieldValue(name)) {
			form.setFieldValue(name, defaultTemplate(templates as never));
		}
	}, [templates, form, name]);
	const options = (templates ?? []).map((t) => ({ value: t.name, label: t.title || t.name }));
	return (
		<Form.Item name={name} label={label}>
			<FocusSelect options={options} loading={query.isLoading} allowClear />
		</Form.Item>
	);
}

/** Dates go to the server as YYYY-MM-DD. */
export function toServer(values: Record<string, unknown>) {
	return Object.fromEntries(
		Object.entries(values).map(([k, v]) => [k, dayjs.isDayjs(v) ? v.format("YYYY-MM-DD") : v]),
	);
}
