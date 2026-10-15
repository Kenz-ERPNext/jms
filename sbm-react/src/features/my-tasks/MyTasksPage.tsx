// Tasks by status, late ones first, as a table on a laptop and cards on a phone.
// Task Staff see their own tasks (their home page); office users see every task, can
// filter by who it is assigned to and see the assignee. Ten tasks a page.

import { Alert, Empty, Flex, Grid, Pagination, Skeleton, Space, Tabs, Typography } from "antd";
import { useState } from "react";

import LinkSelect from "@/components/LinkSelect";
import { tokens } from "@/theme/tokens";

import TaskCard from "./TaskCard";
import TaskTable from "./TaskTable";
import { useMyTasks } from "./useMyTasks";

const TABS = ["Open", "In Progress", "Pending", "Completed"];
const PAGE_SIZE = 10;

export default function MyTasksPage() {
	const [assignedTo, setAssignedTo] = useState<string>();
	const { data, isLoading, error, setStatus, saving } = useMyTasks(assignedTo);
	const [tab, setTab] = useState("Open");
	const [page, setPage] = useState(1);
	const all = data?.scope === "all";
	const tasks = data?.tasks ?? [];
	const count = (status: string) => tasks.filter((t) => t.status === status).length;
	const shown = tasks.filter((t) => t.status === tab);
	const EMPTY = `No ${tab.toLowerCase()} tasks`;
	// a table on a laptop, cards on a phone
	const wide = Grid.useBreakpoint().lg;
	const onPage = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
	// any change of what is listed starts again at page 1
	const reset =
		<T,>(set: (v: T) => void) =>
		(v: T) => (set(v), setPage(1));

	return (
		<Flex vertical gap={tokens.space.lg}>
			<Flex justify="space-between" align="center" wrap gap={tokens.space.sm}>
				<div>
					<Typography.Title level={3} style={{ margin: 0 }}>
						{all ? "Tasks" : "My Tasks"}
					</Typography.Title>
					<Typography.Text type="secondary">
						{all
							? "All tasks of open jobs. Tap a button to update one."
							: "Tasks assigned to you. Tap a button to update one."}
					</Typography.Text>
				</div>
				<Space wrap>
					{all && (
						<LinkSelect
							doctype="Employee"
							labelField="employee_name"
							placeholder="Assigned to: everyone"
							style={{ width: 220 }}
							value={assignedTo}
							onChange={(v) => reset(setAssignedTo)(v as string | undefined)}
						/>
					)}
				</Space>
			</Flex>

			{error && (
				<Alert
					type="error"
					showIcon
					message="Could not load the tasks"
					description={error.message}
				/>
			)}
			{isLoading && <Skeleton active paragraph={{ rows: 6 }} />}
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
					<Flex justify="space-between" align="center" wrap gap={tokens.space.sm}>
						{/* tabs scroll sideways on a phone instead of widening the page */}
						<Tabs
							activeKey={tab}
							onChange={reset(setTab)}
							style={{ minWidth: 0, maxWidth: "100%" }}
							items={TABS.map((s) => ({ key: s, label: `${s} (${count(s)})` }))}
						/>
					</Flex>
					{tab === "Completed" && (
						<Typography.Text type="secondary">
							Completed in the last 30 days.
						</Typography.Text>
					)}
					{wide ? (
						<TaskTable
							tasks={onPage}
							showAssignee={all}
							savingTask={saving?.task}
							onStatus={setStatus}
							empty={EMPTY}
						/>
					) : onPage.length ? (
						<Flex vertical gap={tokens.space.md}>
							{onPage.map((task) => (
								<TaskCard
									key={task.name}
									task={task}
									showAssignee={all}
									saving={saving?.task === task.name}
									onStatus={(status, reason) =>
										setStatus(task.name, status, reason)
									}
								/>
							))}
						</Flex>
					) : (
						<Empty description={EMPTY} />
					)}
					{shown.length > PAGE_SIZE && (
						<Pagination
							align="end"
							current={page}
							pageSize={PAGE_SIZE}
							total={shown.length}
							showSizeChanger={false}
							showTotal={(total, [from, to]) => `${from}–${to} of ${total} tasks`}
							onChange={setPage}
						/>
					)}
				</>
			)}
		</Flex>
	);
}
