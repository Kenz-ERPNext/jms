// Tasks tab: every task with who does it, when and its status. Read-only here;
// changing status and assignee in place comes with FE-10.

import { useMany } from "@refinedev/core";
import { Table, Tag, Typography } from "antd";

import StatusPill from "@/components/StatusPill";
import { formatDate, formatMoney } from "@/lib/format";
import { tokens } from "@/theme/tokens";

import type { JobTask } from "../useJob";

export default function TasksTab({ tasks }: { tasks: JobTask[] }) {
	const employeeIds = [...new Set(tasks.map((t) => t.assigned_to).filter(Boolean))] as string[];
	const employees = useMany({
		resource: "Employee",
		ids: employeeIds,
		meta: { fields: ["name", "employee_name"] },
		queryOptions: { enabled: employeeIds.length > 0 },
	});
	const employeeName = Object.fromEntries(
		(employees.query.data?.data ?? []).map((e) => [e.name, e.employee_name]),
	);
	const done = tasks.filter((t) => t.status === "Completed").length;

	return (
		<>
			<Typography.Text type="secondary">
				{done} of {tasks.length} tasks done. Changing tasks here comes next; for now use
				ERPNext.
			</Typography.Text>
			<Table<JobTask>
				style={{ marginTop: tokens.space.md }}
				size="middle"
				rowKey="name"
				pagination={false}
				dataSource={tasks}
				scroll={{ x: "max-content" }}
				locale={{
					emptyText:
						"No tasks yet. They are made from the services when the job is saved.",
				}}
				columns={[
					{ title: "#", dataIndex: "idx", width: 48 },
					{ title: "Task", dataIndex: "task_name" },
					{
						title: "Done by",
						render: (_, t) =>
							t.employee__outsource === "Outsource" ? (
								<>
									<Tag>Outsource</Tag>
									{t.outsource_supplier || t.assigned_tos}
								</>
							) : (
								(t.assigned_to &&
									(employeeName[t.assigned_to] ?? t.assigned_to)) || (
									<Typography.Text type="warning">Not assigned</Typography.Text>
								)
							),
					},
					{
						title: "Charge",
						dataIndex: "outsource_charge",
						align: "right",
						render: (v?: number) => (v ? formatMoney(v) : ""),
					},
					{ title: "Due", dataIndex: "due_date", render: (v?: string) => formatDate(v) },
					{
						title: "Status",
						dataIndex: "status",
						render: (v: string, t) => (
							<>
								<StatusPill value={v} />
								{t.status === "Pending" && t.pending_reason && (
									<Typography.Text
										type="secondary"
										style={{ display: "block", fontSize: tokens.font.size.sm }}
									>
										{t.pending_reason}
									</Typography.Text>
								)}
							</>
						),
					},
					{
						title: "Finished",
						dataIndex: "completion_date",
						render: (v?: string) => formatDate(v),
					},
				]}
			/>
		</>
	);
}
