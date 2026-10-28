// Tasks of the job: who does each one (an employee, or an outside party with its
// charge) and its status. Choosing a service adds its tasks (serviceTasks.ts);
// more can be added here.

import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import {
	Button,
	Form,
	Input,
	InputNumber,
	Segmented,
	Select,
	Space,
	Table,
	Typography,
} from "antd";

import LinkSelect from "@/components/LinkSelect";
import { tokens } from "@/theme/tokens";

import { TASK_STATUSES, type TaskRow } from "./types";

export default function TasksTable({ isNew }: { isNew: boolean }) {
	const rows: TaskRow[] = Form.useWatch("tasks") ?? [];

	return (
		<Form.List name="tasks">
			{(fields, { add, remove }) => (
				<>
					{isNew && (
						<Typography.Text type="secondary">
							Choosing a service adds its tasks here. You can add more tasks.
						</Typography.Text>
					)}
					<Table
						style={{ marginTop: tokens.space.sm }}
						size="small"
						pagination={false}
						dataSource={fields}
						rowKey="key"
						scroll={{ x: "max-content" }}
						locale={{ emptyText: "No tasks yet" }}
						columns={[
							{
								title: "Task",
								render: (_, f) => (
									<Form.Item
										name={[f.name, "task_name"]}
										noStyle
										rules={[{ required: true }]}
									>
										<Input
											placeholder="What has to be done"
											style={{ minWidth: 200 }}
										/>
									</Form.Item>
								),
							},
							{
								title: "Done by",
								render: (_, f) => {
									const outsourced =
										rows[f.name]?.employee__outsource === "Outsource";
									return (
										<Space>
											<Form.Item
												name={[f.name, "employee__outsource"]}
												noStyle
												initialValue="Employee"
											>
												<Segmented
													size="small"
													options={["Employee", "Outsource"]}
												/>
											</Form.Item>
											{outsourced ? (
												<Form.Item name={[f.name, "assigned_tos"]} noStyle>
													<LinkSelect
														doctype="Outsourced Party"
														placeholder="Outside party"
														style={{ width: 170 }}
													/>
												</Form.Item>
											) : (
												<Form.Item name={[f.name, "assigned_to"]} noStyle>
													<LinkSelect
														doctype="Employee"
														labelField="employee_name"
														placeholder="Employee"
														style={{ width: 170 }}
													/>
												</Form.Item>
											)}
										</Space>
									);
								},
							},
							{
								title: "Charge",
								render: (_, f) =>
									rows[f.name]?.employee__outsource === "Outsource" && (
										<Form.Item name={[f.name, "outsource_charge"]} noStyle>
											<InputNumber
												min={0}
												placeholder="Cost"
												style={{ width: 100 }}
											/>
										</Form.Item>
									),
							},
							{
								title: "Status",
								render: (_, f) => (
									<Space direction="vertical" size={tokens.space.xs}>
										<Form.Item
											name={[f.name, "status"]}
											noStyle
											initialValue="Open"
										>
											<Select
												options={TASK_STATUSES.map((s) => ({
													value: s,
													label: s,
												}))}
												style={{ width: 120 }}
											/>
										</Form.Item>
										{rows[f.name]?.status === "Pending" && (
											<Form.Item
												name={[f.name, "pending_reason"]}
												noStyle
												rules={[
													{
														required: true,
														message: "Why is it pending?",
													},
												]}
											>
												<Input
													placeholder="Why is it pending?"
													style={{ width: 200 }}
												/>
											</Form.Item>
										)}
									</Space>
								),
							},
							{
								width: 48,
								render: (_, f) => (
									<Button
										type="text"
										danger
										icon={<DeleteOutlined />}
										onClick={() => remove(f.name)}
									/>
								),
							},
						]}
					/>
					<Button
						icon={<PlusOutlined />}
						onClick={() => add({ employee__outsource: "Employee", status: "Open" })}
						style={{ marginTop: tokens.space.sm }}
					>
						Add task
					</Button>
				</>
			)}
		</Form.List>
	);
}
