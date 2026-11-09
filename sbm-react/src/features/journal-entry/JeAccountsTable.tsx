// The account rows of a Journal Entry form: account, party type and party, job,
// debit or credit (typing one clears the other), with the totals and the difference
// underneath. A receivable or payable account sets its party type.

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Form, Input, InputNumber, Table, Typography } from "antd";

import FocusSelect from "@/components/FocusSelect";
import LinkSelect from "@/components/LinkSelect";
import { getBoot } from "@/lib/boot";
import { formatMoney } from "@/lib/format";
import { callMethod } from "@/lib/frappe";
import { tokens } from "@/theme/tokens";

import { PARTY_TYPES, partyTypeFor, totals, type JeRow } from "./journalEntry";

/** A new row: no amounts, the default job (JMS Settings), changeable. */
export const newRow = (): JeRow => ({
	debit: null,
	credit: null,
	job: getBoot().default_je_job || undefined,
});

export default function JeAccountsTable() {
	const form = Form.useFormInstance();
	const rows: JeRow[] = Form.useWatch("accounts", form) ?? [];
	const sum = totals(rows);
	const company = getBoot().company;

	/** A receivable or payable account needs a party: its type is set from the account. */
	const accountChanged = async (i: number, account?: string) => {
		form.setFieldValue(["accounts", i, "party"], undefined);
		if (!account) return;
		const res = await callMethod<{ account_type?: string }>("frappe.client.get_value", {
			doctype: "Account",
			filters: account,
			fieldname: "account_type",
		}).catch(() => undefined);
		form.setFieldValue(["accounts", i, "party_type"], partyTypeFor(res?.account_type));
	};

	const accountFilters = [
		{ field: "is_group", operator: "eq" as const, value: 0 },
		...(company ? [{ field: "company", operator: "eq" as const, value: company }] : []),
	];

	/** Debit or Credit; typing one clears the other. */
	const amount = (field: "debit" | "credit", other: "debit" | "credit") => ({
		title: field === "debit" ? "Debit" : "Credit",
		width: 140,
		align: "right" as const,
		render: (_: unknown, f: { name: number }) => (
			<Form.Item name={[f.name, field]} noStyle>
				<InputNumber
					min={0}
					style={{ width: 130 }}
					onChange={(v) => v && form.setFieldValue(["accounts", f.name, other], null)}
				/>
			</Form.Item>
		),
	});

	return (
		<Form.List name="accounts">
			{(fields, { add, remove }) => (
				<>
					<Table
						size="small"
						pagination={false}
						rowKey="key"
						dataSource={fields}
						scroll={{ x: "max-content" }}
						columns={[
							{
								title: "Account",
								width: 260,
								render: (_, f) => (
									<Form.Item
										name={[f.name, "account"]}
										noStyle
										rules={[{ required: true, message: "Account?" }]}
									>
										<LinkSelect
											doctype="Account"
											filters={accountFilters}
											placeholder="Account"
											style={{ width: 240 }}
											onChange={(v) => void accountChanged(f.name, v)}
										/>
									</Form.Item>
								),
							},
							{
								title: "Party Type",
								width: 140,
								render: (_, f) => (
									<Form.Item name={[f.name, "party_type"]} noStyle>
										<FocusSelect
											allowClear
											placeholder="—"
											style={{ width: 130 }}
											options={PARTY_TYPES.map((v) => ({
												value: v,
												label: v,
											}))}
											onChange={() =>
												form.setFieldValue(
													["accounts", f.name, "party"],
													undefined,
												)
											}
										/>
									</Form.Item>
								),
							},
							{
								title: "Party",
								width: 200,
								render: (_, f) => {
									const type = rows[f.name]?.party_type;
									return (
										<Form.Item name={[f.name, "party"]} noStyle>
											{type ? (
												<LinkSelect
													key={type}
													doctype={type}
													placeholder={type}
													style={{ width: 190 }}
												/>
											) : (
												<Input
													disabled
													placeholder="—"
													style={{ width: 190 }}
												/>
											)}
										</Form.Item>
									);
								},
							},
							{
								title: "Job",
								width: 170,
								render: (_, f) => (
									<Form.Item name={[f.name, "job"]} noStyle>
										<LinkSelect
											doctype="Job"
											placeholder="Job"
											style={{ width: 160 }}
										/>
									</Form.Item>
								),
							},
							amount("debit", "credit"),
							amount("credit", "debit"),
							{
								width: 40,
								render: (_, f) => (
									<Button
										type="text"
										size="small"
										danger
										aria-label="Remove row"
										icon={<DeleteOutlined />}
										disabled={fields.length <= 2}
										onClick={() => remove(f.name)}
									/>
								),
							},
						]}
						summary={() => (
							<Table.Summary.Row>
								<Table.Summary.Cell index={0} colSpan={4}>
									<Typography.Text
										type={sum.difference ? "danger" : "secondary"}
									>
										{sum.difference
											? `Difference ${formatMoney(sum.difference)}`
											: "Balanced"}
									</Typography.Text>
								</Table.Summary.Cell>
								<Table.Summary.Cell index={4} align="right">
									<strong>{formatMoney(sum.debit)}</strong>
								</Table.Summary.Cell>
								<Table.Summary.Cell index={5} align="right">
									<strong>{formatMoney(sum.credit)}</strong>
								</Table.Summary.Cell>
								<Table.Summary.Cell index={6} />
							</Table.Summary.Row>
						)}
					/>
					<Button
						icon={<PlusOutlined />}
						style={{ marginTop: tokens.space.sm }}
						onClick={() => add(newRow())}
					>
						Add row
					</Button>
				</>
			)}
		</Form.List>
	);
}
