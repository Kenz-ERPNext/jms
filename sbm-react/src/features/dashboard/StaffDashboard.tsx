// Dashboard of a Task Staff user: their own tasks at a glance. How many are to do,
// in progress, pending and done (last 30 days), how much is done, and the late and
// next tasks. Same data as My Tasks (jms.api.tasks.my_tasks), no extra call.

import {
	CheckCircleOutlined,
	ClockCircleOutlined,
	PauseCircleOutlined,
	PlayCircleOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Col, Empty, Flex, Progress, Row, Skeleton, Typography } from "antd";
import dayjs from "dayjs";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";

import { useMyTasks, type MyTask } from "@/features/my-tasks/useMyTasks";
import { getBoot } from "@/lib/boot";
import { formatDate } from "@/lib/format";
import { HOME } from "@/lib/redirect";
import { tokens } from "@/theme/tokens";

const { color, space, font, radius } = tokens;
const CARDS: { status: string; label: string; icon: ReactNode; tint: string }[] = [
	{ status: "Open", label: "To do", icon: <ClockCircleOutlined />, tint: color.primary },
	{
		status: "In Progress",
		label: "In progress",
		icon: <PlayCircleOutlined />,
		tint: color.info,
	},
	{ status: "Pending", label: "Pending", icon: <PauseCircleOutlined />, tint: color.warning },
	{
		status: "Completed",
		label: "Completed (30 days)",
		icon: <CheckCircleOutlined />,
		tint: color.success,
	},
];
const LIST_LENGTH = 5;
const due = (t: MyTask) => (t.due_date ? dayjs(t.due_date).valueOf() : Infinity);

function TaskList({ title, tasks, empty }: { title: string; tasks: MyTask[]; empty: string }) {
	return (
		<Card title={title} style={{ height: "100%" }}>
			{tasks.length ? (
				<Flex vertical gap={space.sm}>
					{tasks.map((t) => (
						<Flex
							key={t.name}
							justify="space-between"
							gap={space.md}
							className="sbm-row"
						>
							<div style={{ minWidth: 0 }}>
								<Typography.Text strong>{t.task_name}</Typography.Text>
								<Typography.Text
									type="secondary"
									ellipsis
									style={{ display: "block", fontSize: font.size.sm }}
								>
									{t.job} · {t.customer_name || t.job_title}
								</Typography.Text>
							</div>
							<Typography.Text
								type={t.overdue ? "danger" : "secondary"}
								style={{ whiteSpace: "nowrap" }}
							>
								{t.due_date ? formatDate(t.due_date) : "No due date"}
							</Typography.Text>
						</Flex>
					))}
				</Flex>
			) : (
				<Empty description={empty} image={Empty.PRESENTED_IMAGE_SIMPLE} />
			)}
		</Card>
	);
}

export default function StaffDashboard() {
	const { data, isLoading, error } = useMyTasks();
	const navigate = useNavigate();
	const tasks = data?.tasks ?? [];
	const count = (s: string) => tasks.filter((t) => t.status === s).length;
	const done = count("Completed");
	const percent = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
	const open = tasks.filter((t) => t.status !== "Completed");
	const late = open.filter((t) => t.overdue).sort((a, b) => due(a) - due(b));
	const next = open.filter((t) => !t.overdue).sort((a, b) => due(a) - due(b));
	const name = (getBoot().full_name || "").split(" ")[0];

	return (
		<Flex vertical gap={space.lg}>
			<Flex justify="space-between" align="center" wrap gap={space.sm}>
				<div>
					<Typography.Title level={3} style={{ margin: 0 }}>
						{name ? `Hello, ${name}` : "My Dashboard"}
					</Typography.Title>
					<Typography.Text type="secondary">Your tasks at a glance.</Typography.Text>
				</div>
				<Button type="primary" onClick={() => navigate(`${HOME}/my-tasks`)}>
					Open my tasks
				</Button>
			</Flex>
			{error && (
				<Alert
					type="error"
					showIcon
					message="Could not load your tasks"
					description={error.message}
				/>
			)}
			{isLoading && <Skeleton active paragraph={{ rows: 8 }} />}
			{data && !data.has_employee && (
				<Alert
					type="info"
					showIcon
					message="No tasks can be assigned to you yet"
					description="Your user is not linked to an Employee. Ask the admin to set your user as the User ID on your Employee record."
				/>
			)}
			{data?.has_employee && (
				<>
					<Row gutter={[space.lg, space.lg]}>
						{CARDS.map((c) => (
							<Col key={c.status} xs={12} lg={6}>
								<Card
									hoverable
									className="sbm-lift"
									onClick={() => navigate(`${HOME}/my-tasks`)}
								>
									<Flex justify="space-between" align="start">
										<div>
											<Typography.Text type="secondary">
												{c.label}
											</Typography.Text>
											<Typography.Title
												level={2}
												style={{ margin: 0, color: c.tint }}
											>
												{count(c.status)}
											</Typography.Title>
										</div>
										<span
											style={{
												fontSize: font.size.xl,
												color: c.tint,
												background: `${c.tint}1A`,
												borderRadius: radius.md,
												padding: `${space.xs}px ${space.sm}px`,
											}}
										>
											{c.icon}
										</span>
									</Flex>
								</Card>
							</Col>
						))}
					</Row>
					<Row gutter={[space.lg, space.lg]}>
						<Col xs={24} lg={6}>
							<Card title="Done" style={{ height: "100%", textAlign: "center" }}>
								<Progress
									type="circle"
									percent={percent}
									strokeColor={{ "0%": color.primary, "100%": color.accent }}
								/>
								<Typography.Paragraph
									type="secondary"
									style={{ marginTop: space.md, marginBottom: 0 }}
								>
									{done} of {tasks.length} tasks
									{late.length > 0 && (
										<Typography.Text type="danger">
											{" "}
											· {late.length} late
										</Typography.Text>
									)}
								</Typography.Paragraph>
							</Card>
						</Col>
						<Col xs={24} lg={9}>
							<TaskList
								title={`Late (${late.length})`}
								tasks={late.slice(0, LIST_LENGTH)}
								empty="Nothing late. Well done!"
							/>
						</Col>
						<Col xs={24} lg={9}>
							<TaskList
								title="Coming up"
								tasks={next.slice(0, LIST_LENGTH)}
								empty="No open tasks"
							/>
						</Col>
					</Row>
				</>
			)}
		</Flex>
	);
}
