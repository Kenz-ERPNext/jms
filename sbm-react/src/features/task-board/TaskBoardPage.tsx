// Task Board (Admin): how many jobs have tasks in each status, a searchable list of
// jobs with their task counts, and a job's tasks as a kanban when it is clicked.
// Replaces the old desk dashboard (/app/jms-dashboard).

import { Alert, Card, Flex, Input, Tooltip, Typography } from "antd";
import { useState } from "react";
import { useSearchParams } from "react-router";

import DataTable from "@/components/DataTable";
import StatusPill from "@/components/StatusPill";
import { formatDate } from "@/lib/format";
import { tokens } from "@/theme/tokens";

import JobBoardDrawer from "./JobBoardDrawer";
import StatusTiles, { TINT } from "./StatusTiles";
import { BOARD_STATUSES, statusKey, useBoardJobs, type BoardJob } from "./useTaskBoard";

const PAGE_SIZE = 10;
const { color, space, font } = tokens;

export default function TaskBoardPage() {
	// the chosen status is in the URL, so the Jobs list can open the board on one
	const [params, setParams] = useSearchParams();
	const status = params.get("status") || undefined;
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const [open, setOpen] = useState<string>();
	const { data, isLoading, error } = useBoardJobs(status, search, page, PAGE_SIZE);
	const pick = (s?: string) => (setParams(s ? { status: s } : {}), setPage(1));

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
			<StatusTiles active={status} onPick={pick} />
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
