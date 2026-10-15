// Tasks as a table, for laptops: task, job, customer, who does it, due date,
// status and the status buttons. Late rows are marked in red.

import { Table, Typography } from "antd";

import StatusPill from "@/components/StatusPill";
import { formatDate } from "@/lib/format";
import { tokens } from "@/theme/tokens";

import Assignee from "./assignee";
import TaskButtons from "./TaskButtons";
import type { MyTask } from "./useMyTasks";

interface TaskTableProps {
	tasks: MyTask[];
	showAssignee: boolean;
	savingTask?: string;
	onStatus: (task: string, status: string, reason?: string) => Promise<void>;
	empty: string;
}

export default function TaskTable({
	tasks,
	showAssignee,
	savingTask,
	onStatus,
	empty,
}: TaskTableProps) {
	const small = { fontSize: tokens.font.size.sm };
	return (
		<Table<MyTask>
			size="middle"
			rowKey="name"
			dataSource={tasks}
			pagination={false}
			// fits the screen: long text wraps or ends in "…" instead of scrolling sideways
			tableLayout="fixed"
			locale={{ emptyText: empty }}
			columns={[
				{
					title: "Task",
					width: "24%",
					dataIndex: "task_name",
					render: (v: string, t) => (
						<>
							<Typography.Text strong>{v}</Typography.Text>
							{t.status === "Pending" && t.pending_reason && (
								<Typography.Text
									type="secondary"
									style={{ ...small, display: "block" }}
								>
									Pending: {t.pending_reason}
								</Typography.Text>
							)}
						</>
					),
				},
				{
					title: "Job",
					width: "14%",
					dataIndex: "job",
					render: (v: string, t) => (
						<>
							<Typography.Text
								style={{ color: tokens.color.primary, whiteSpace: "nowrap" }}
							>
								{v}
							</Typography.Text>
							<Typography.Text
								type="secondary"
								style={{ ...small, display: "block" }}
							>
								{t.job_title}
							</Typography.Text>
						</>
					),
				},
				{ title: "Customer", dataIndex: "customer_name", width: "16%", ellipsis: true },
				...(showAssignee
					? [
							{
								title: "Assigned to",
								key: "assignee",
								render: (_: unknown, t: MyTask) => <Assignee task={t} />,
							},
						]
					: []),
				{
					title: "Due",
					width: 130,
					dataIndex: "due_date",
					render: (v: string, t) => (
						<Typography.Text
							type={t.overdue ? "danger" : undefined}
							style={{ whiteSpace: "nowrap" }}
						>
							{formatDate(v)}
							{t.overdue && <span style={small}> · late</span>}
						</Typography.Text>
					),
				},
				{
					title: "Status",
					width: 110,
					dataIndex: "status",
					render: (v: string) => <StatusPill value={v} />,
				},
				{
					title: "",
					key: "actions",
					align: "right",
					width: 110,
					render: (_, t) => (
						<TaskButtons
							task={t}
							size="small"
							saving={savingTask === t.name}
							onStatus={(status, reason) => onStatus(t.name, status, reason)}
						/>
					),
				},
			]}
		/>
	);
}
