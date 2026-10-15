// Services of the job, the same columns as the ERPNext Job form (Job Item). Choosing
// a Code (Work Template) fills its description, qty, service charge, gov fee, extra and
// VAT, and adds its tasks (serviceTasks.ts). Totals update as you type.

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Flex, Form, InputNumber, Table, Typography } from "antd";

import LinkSelect from "@/components/LinkSelect";
import { formatMoney } from "@/lib/format";
import { tokens } from "@/theme/tokens";

import { getTemplate, syncServiceTasks } from "./serviceTasks";
import { lineTotal, type ServiceRow } from "./types";

const TEMPLATE_FIELDS = [
	"description",
	"item_code",
	"job_qty",
	"fee_price",
	"extra",
	"surcharge",
	"vat",
];

export default function ServicesTable() {
	const form = Form.useFormInstance();
	const rows: ServiceRow[] = Form.useWatch("items", form) ?? [];
	const total = rows.reduce((sum, row) => sum + lineTotal(row ?? {}), 0);

	/** Tasks follow the services, as on the ERPNext form. */
	const syncTasks = async () =>
		form.setFieldValue(
			"tasks",
			await syncServiceTasks(
				form.getFieldValue("items") ?? [],
				form.getFieldValue("tasks") ?? [],
			),
		);

	const fillFromTemplate = async (index: number, template?: string) => {
		if (template) {
			const t = (await getTemplate(template)) as unknown as Record<string, unknown>;
			const filled = Object.fromEntries(TEMPLATE_FIELDS.map((f) => [f, t[f]]));
			form.setFieldValue(["items", index], {
				...form.getFieldValue(["items", index]),
				...filled,
				job_qty: t.job_qty || 1,
				// as on the ERPNext form: the template's charge, kept for reference
				old_fee_price: t.fee_price,
			});
		}
		await syncTasks();
	};

	const amount =
		(name: string, width = 88) =>
		(index: number) => (
			<Form.Item name={[index, name]} noStyle>
				<InputNumber min={0} style={{ width }} />
			</Form.Item>
		);

	return (
		<Form.List name="items">
			{(fields, { add, remove }) => (
				<>
					<Table
						size="small"
						pagination={false}
						dataSource={fields}
						rowKey="key"
						scroll={{ x: "max-content" }}
						locale={{ emptyText: "Add the services for this job" }}
						columns={[
							{
								title: "Code",
								render: (_, f) => (
									<Form.Item
										name={[f.name, "work_template"]}
										noStyle
										rules={[{ required: true, message: "Choose a code" }]}
									>
										<LinkSelect
											doctype="Work Template"
											descriptionField="description"
											placeholder="Code"
											style={{ width: 100 }}
											onChange={(v) => fillFromTemplate(f.name, v as string)}
										/>
									</Form.Item>
								),
							},
							{
								title: "Description",
								render: (_, f) => (
									<Typography.Text
										style={{ display: "inline-block", minWidth: 120 }}
									>
										{rows[f.name]?.description}
									</Typography.Text>
								),
							},
							{ title: "Job Qty", render: (_, f) => amount("job_qty", 64)(f.name) },
							{
								title: "Service Charge",
								render: (_, f) => amount("fee_price")(f.name),
							},
							{
								title: "Old Service Charge",
								align: "right",
								render: (_, f) => formatMoney(rows[f.name]?.old_fee_price),
							},
							{ title: "Gov Fee", render: (_, f) => amount("surcharge")(f.name) },
							{ title: "Extra", render: (_, f) => amount("extra")(f.name) },
							{ title: "VAT %", render: (_, f) => amount("vat", 64)(f.name) },
							{
								title: "Total",
								align: "right",
								render: (_, f) => (
									<strong style={{ whiteSpace: "nowrap" }}>
										{formatMoney(lineTotal(rows[f.name] ?? {}))}
									</strong>
								),
							},
							{
								width: 48,
								render: (_, f) => (
									<Button
										type="text"
										danger
										icon={<DeleteOutlined />}
										onClick={() => (remove(f.name), void syncTasks())}
									/>
								),
							},
						]}
					/>
					<Flex
						justify="space-between"
						align="center"
						style={{ marginTop: tokens.space.sm }}
					>
						<Button icon={<PlusOutlined />} onClick={() => add({ job_qty: 1 })}>
							Add service
						</Button>
						<Typography.Text strong style={{ fontSize: tokens.font.size.lg }}>
							Total: {formatMoney(total)}
						</Typography.Text>
					</Flex>
				</>
			)}
		</Form.List>
	);
}
