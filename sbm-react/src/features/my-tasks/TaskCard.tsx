// One task as a card, made for phones: what to do, for which job and customer, when
// it is due, who does it, and the status buttons.

import { CalendarOutlined, UserOutlined } from "@ant-design/icons";
import { Card, Flex, Space, Tag, Typography } from "antd";

import StatusPill from "@/components/StatusPill";
import { formatDate } from "@/lib/format";
import { tokens } from "@/theme/tokens";

import Assignee from "./assignee";
import TaskButtons, { type TaskButtonsProps } from "./TaskButtons";

interface TaskCardProps extends TaskButtonsProps {
	/** Show who the task is assigned to (office users see everyone's tasks). */
	showAssignee?: boolean;
}

export default function TaskCard({ task, showAssignee, saving, onStatus }: TaskCardProps) {
	const { color, space, font } = tokens;

	return (
		<Card
			size="small"
			className="sbm-lift"
			style={{ borderLeft: `4px solid ${task.overdue ? color.danger : color.primary}` }}
		>
			<Flex justify="space-between" align="start" gap={space.sm} wrap>
				<div style={{ minWidth: 0, flex: "1 1 220px" }}>
					<Typography.Text strong style={{ fontSize: font.size.lg }}>
						{task.task_name}
					</Typography.Text>
					<div>
						<Typography.Text style={{ color: color.primary }}>
							{task.job}
						</Typography.Text>
						<Typography.Text type="secondary">
							{task.job_title ? ` · ${task.job_title}` : ""}
							{task.customer_name ? ` · ${task.customer_name}` : ""}
						</Typography.Text>
					</div>
					<Space size={space.sm} wrap style={{ marginTop: space.xs }}>
						<StatusPill value={task.status} />
						{showAssignee && (
							<span>
								<UserOutlined /> <Assignee task={task} />
							</span>
						)}
						{task.due_date && (
							<Typography.Text type={task.overdue ? "danger" : "secondary"}>
								<CalendarOutlined /> Due {formatDate(task.due_date)}
								{task.overdue ? " · late" : ""}
							</Typography.Text>
						)}
						{task.priority && ["High", "Urgent"].includes(task.priority) && (
							<Tag color={color.warning}>{task.priority}</Tag>
						)}
					</Space>
					{task.status === "Pending" && task.pending_reason && (
						<Typography.Paragraph
							type="secondary"
							style={{ margin: `${space.xs}px 0 0` }}
						>
							Pending: {task.pending_reason}
						</Typography.Paragraph>
					)}
				</div>
				<TaskButtons task={task} saving={saving} onStatus={onStatus} />
			</Flex>
		</Card>
	);
}
