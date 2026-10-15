// Task Board (Admin): how many jobs have tasks in each status, a searchable list of
// jobs with their task counts, and a job's tasks as a kanban when it is clicked.
// Replaces the old desk dashboard (/app/jms-dashboard).

import { Alert, Card, Col, Flex, Input, Row, Tooltip, Typography } from "antd";
import { useState } from "react";

import DataTable from "@/components/DataTable";
import StatusPill from "@/components/StatusPill";
import { formatDate } from "@/lib/format";
import { tokens } from "@/theme/tokens";

import JobBoardDrawer from "./JobBoardDrawer";
import {
	BOARD_STATUSES,
	statusKey,
	useBoardCounts,
	useBoardJobs,
	type BoardJob,
} from "./useTaskBoard";

const PAGE_SIZE = 10;
const { color, space, font } = tokens;
const TINT: Record<string, string> = {
	Open: color.textMuted,
	"In Progress": color.info,
	Pending: color.warning,
	Completed: color.success,
	Cancelled: color.danger,
};

export default function TaskBoardPage() {
	const [status, setStatus] = useState<string>();
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const [open, setOpen] = useState<string>();
	const counts = useBoardCounts();
	const { data, isLoading, error } = useBoardJobs(status, search, page, PAGE_SIZE);
	const pick = (s?: string) => (setStatus(s), setPage(1));

	const tile = (label: string, s: string | undefined, key: string) => {
		const active = status === s;
		return (
			<Col key={label} xs={12} md={8} xl={4}>
				<Card
					size="small"
					hoverable
					className="sbm-lift"
					onClick={() => pick(s)}
					style={{
						height: "100%",
						borderColor: active ? color.primary : undefined,
						background: active ? color.primaryBg : undefined,
					}}
				>
					<Typography.Text type="secondary">{label}</Typography.Text>
					<Typography.Title
						level={3}
						style={{ margin: 0, color: s ? TINT[s] : color.text }}
					>
						{(counts?.[key] ?? 0).toLocaleString()}
					</Typography.Title>
					<Typography.Text type="secondary" style={{ fontSize: font.size.sm }}>
						jobs · {(counts?.tasks?.[key] ?? 0).toLocaleString()} tasks
					</Typography.Text>
				</Card>
			</Col>
		);
	};

	return (
		<Flex vertical gap={space.lg}>
			<div>
				<Typography.Title level={3} style={{ margin: 0 }}>
					Task Board
				</Typography.Title>
				<Typography.Text type="secondary">
					Jobs by the status of their tasks. Click a box to filter, a job to open its
					tasks.
				</Typography.Text>
			</div>
			<Row gutter={[space.md, space.md]}>
				{tile("All jobs", undefined, "all")}
				{BOARD_STATUSES.map((s) => tile(s, s, statusKey(s)))}
			</Row>
			{error && (
				<Alert
					type="error"
					showIcon
					message="Could not load the board"
					description={error.message}
				/>
			)}
			<Card>
				<Input.Search
					allowClear
					placeholder="Job no, title or customer"
					style={{ maxWidth: 360, marginBottom: space.md }}
					onSearch={(v) => (setSearch(v.trim()), setPage(1))}
				/>
				<DataTable<BoardJob>
					noun="jobs"
					rowsHeight="calc(100vh - 520px)"
					loading={isLoading}
					dataSource={data?.jobs ?? []}
					tableLayout="fixed"
					onRow={(job) => ({
						onClick: () => setOpen(job.name),
						style: { cursor: "pointer" },
					})}
					pagination={{
						current: page,
						pageSize: PAGE_SIZE,
						total: data?.total ?? 0,
						hideOnSinglePage: false,
						onChange: setPage,
					}}
					columns={[
						{
							title: "Job",
							dataIndex: "name",
							width: "28%",
							render: (v: string, job) => (
								<>
									<Typography.Text strong style={{ color: color.primary }}>
										{v}
									</Typography.Text>
									<Typography.Text
										type="secondary"
										style={{ display: "block", fontSize: font.size.sm }}
									>
										{job.job_title}
									</Typography.Text>
								</>
							),
						},
						{ title: "Customer", dataIndex: "customer_name", ellipsis: true },
						{
							title: "Tasks",
							width: 220,
							render: (_, job) => (
								<Flex gap={space.xs} wrap>
									{BOARD_STATUSES.map((s) => {
										const n = Number(job[statusKey(s)]) || 0;
										return n ? (
											<Tooltip key={s} title={s}>
												<span
													style={{
														color: TINT[s],
														background: `${TINT[s]}1A`,
														borderRadius: 10,
														padding: "0 8px",
														fontWeight: 600,
													}}
												>
													{n}
												</span>
											</Tooltip>
										) : null;
									})}
									<Typography.Text type="secondary">
										of {job.task_total}
									</Typography.Text>
								</Flex>
							),
						},
						{
							title: "Job status",
							dataIndex: "status",
							width: 130,
							render: (v: string) => <StatusPill value={v} />,
						},
						{
							title: "Due",
							dataIndex: "expected_completion_date",
							width: 130,
							render: (v: string, job) => (
								<Typography.Text
									type={
										job.overdue_status === "Overdue" && job.status !== "Closed"
											? "danger"
											: undefined
									}
								>
									{formatDate(v)}
								</Typography.Text>
							),
						},
					]}
				/>
			</Card>
			<JobBoardDrawer job={open} onClose={() => setOpen(undefined)} />
		</Flex>
	);
}
