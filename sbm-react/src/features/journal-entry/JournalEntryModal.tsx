// New Journal Entry in SBM, like ERPNext's form: type, date, reference, the account
// rows (account, party, job, debit, credit) with their totals, and a remark. Save as
// a draft or submit. Filled in from a cancelled entry, it saves as its amendment.

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, App, Button, Flex, Form, Input, Modal, Typography } from "antd";
import dayjs from "dayjs";
import { useState } from "react";

import FocusDatePicker from "@/components/FocusDatePicker";
import FocusSelect from "@/components/FocusSelect";
import { getBoot } from "@/lib/boot";
import { formatMoney } from "@/lib/format";
import { callMethod } from "@/lib/frappe";
import { tokens } from "@/theme/tokens";

import JeAccountsTable, { newRow } from "./JeAccountsTable";
import { NEEDS_REFERENCE, toDoc, totals, VOUCHER_TYPES, type JeValues } from "./journalEntry";

interface Props {
	open: boolean;
	/** Values to start from (a cancelled entry's, when amending). */
	initial?: JeValues;
	amendedFrom?: string;
	onClose: () => void;
	onSaved: (name: string) => void;
}

export default function JournalEntryModal({
	open,
	initial,
	amendedFrom,
	onClose,
	onSaved,
}: Props) {
	const { message } = App.useApp();
	const queryClient = useQueryClient();
	const [form] = Form.useForm<JeValues>();
	const [error, setError] = useState<string>();
	const [saving, setSaving] = useState<"draft" | "submit">();
	const company = getBoot().company;

	const voucherType = Form.useWatch("voucher_type", form);

	const { data: costCenter } = useQuery({
		queryKey: ["company-cost-center", company],
		queryFn: async () =>
			(
				await callMethod<{ cost_center?: string }>("frappe.client.get_value", {
					doctype: "Company",
					filters: company,
					fieldname: "cost_center",
				})
			)?.cost_center,
		enabled: open && !!company,
		staleTime: Infinity,
	});

	const save = async (submit: boolean) => {
		setError(undefined);
		const values = await form.validateFields().catch(() => undefined);
		if (!values) return;
		const filled = values.accounts.filter((r) => r?.account);
		if (filled.length < 2) return setError("Add at least two account rows.");
		const t = totals(filled);
		if (t.difference !== 0)
			return setError(
				`Total debit and credit must be equal (difference ${formatMoney(t.difference)}).`,
			);
		setSaving(submit ? "submit" : "draft");
		try {
			const doc = await callMethod<{ name: string }>("frappe.client.insert", {
				doc: JSON.stringify(toDoc(values, { company, costCenter, amendedFrom, submit })),
			});
			message.success(`${doc.name} ${submit ? "submitted" : "saved as draft"}`);
			void queryClient.invalidateQueries();
			onSaved(doc.name);
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setSaving(undefined);
		}
	};

	return (
		<Modal
			open={open}
			onCancel={onClose}
			width={1280}
			style={{ maxWidth: "calc(100vw - 32px)" }}
			destroyOnHidden
			title={amendedFrom ? `Amend ${amendedFrom}` : "New Journal Entry"}
			footer={
				<Flex justify="end" gap={tokens.space.sm}>
					<Button onClick={onClose}>Cancel</Button>
					<Button
						loading={saving === "draft"}
						disabled={!!saving}
						onClick={() => save(false)}
					>
						Save as draft
					</Button>
					<Button
						type="primary"
						loading={saving === "submit"}
						disabled={!!saving}
						onClick={() => save(true)}
					>
						Submit
					</Button>
				</Flex>
			}
		>
			{amendedFrom && (
				<Typography.Paragraph type="secondary">
					Filled in from the cancelled {amendedFrom}. Change what was wrong and save: the
					new entry is its amendment.
				</Typography.Paragraph>
			)}
			{error && (
				<Alert
					type="error"
					showIcon
					message={error}
					style={{ marginBottom: tokens.space.md }}
				/>
			)}
			<Form<JeValues>
				form={form}
				layout="vertical"
				initialValues={
					initial ?? {
						voucher_type: "Journal Entry",
						posting_date: dayjs(),
						accounts: [newRow(), newRow()],
					}
				}
			>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
						columnGap: tokens.space.md,
					}}
				>
					<Form.Item name="voucher_type" label="Entry Type" rules={[{ required: true }]}>
						<FocusSelect
							options={VOUCHER_TYPES.map((v) => ({ value: v, label: v }))}
						/>
					</Form.Item>
					<Form.Item
						name="posting_date"
						label="Posting Date"
						rules={[{ required: true, message: "Posting Date is required" }]}
					>
						<FocusDatePicker style={{ width: "100%" }} format="DD-MM-YYYY" />
					</Form.Item>
					<Form.Item
						name="cheque_no"
						label="Reference No"
						rules={[
							{
								required: NEEDS_REFERENCE.includes(voucherType),
								message: "Reference No is required for a Bank Entry",
							},
						]}
					>
						<Input placeholder="Cheque / transfer no" />
					</Form.Item>
					<Form.Item
						name="cheque_date"
						label="Reference Date"
						rules={[
							{
								required: NEEDS_REFERENCE.includes(voucherType),
								message: "Reference Date is required for a Bank Entry",
							},
						]}
					>
						<FocusDatePicker style={{ width: "100%" }} format="DD-MM-YYYY" />
					</Form.Item>
				</div>

				<JeAccountsTable />

				<Form.Item
					name="user_remark"
					label="Remark"
					style={{ marginTop: tokens.space.md }}
				>
					<Input.TextArea rows={2} />
				</Form.Item>
			</Form>
		</Modal>
	);
}
