// Jobs list: tabs by stage (with counts), search and filters, 20 jobs a page.
// A row opens the job.

import { PlusOutlined } from "@ant-design/icons";
import { Alert, Button, Card, Flex, Table, Tabs, Typography } from "antd";

import { STAGE_LABEL } from "@/config/stages";
import { useOpenJob } from "@/features/job-form/JobModalProvider";
import { tokens } from "@/theme/tokens";

import { jobsColumns } from "./jobsColumns";
import JobsFilters from "./JobsFilters";
import { useJobsList } from "./useJobsList";

// key "" = all jobs; the others are list_jobs tabs
const TABS: { key: string; label: string }[] = [
	{ key: "", label: "All" },
	...Object.entries(STAGE_LABEL).map(([key, label]) => ({ key, label })),
	{ key: "Overdue", label: "Late" },
	{ key: "Closed", label: "Closed" },
];

export default function JobsListPage() {
	const list = useJobsList();
	const openJob = useOpenJob();
	const counts = list.data?.tab_counts;

	return (
		<Flex vertical gap={tokens.space.lg}>
			<Flex justify="space-between" align="center" wrap gap={tokens.space.sm}>
				<div>
					<Typography.Title level={3} style={{ margin: 0 }}>
						Jobs
					</Typography.Title>
					<Typography.Text type="secondary">
						Find a job by its stage, search or filters. Click a job to open it.
					</Typography.Text>
				</div>
				<Button type="primary" icon={<PlusOutlined />} onClick={() => openJob()}>
					New Job
				</Button>
			</Flex>

			<Card styles={{ body: { paddingTop: 0 } }}>
				<Tabs
					activeKey={list.tab}
					onChange={(tab) => list.update({ tab })}
					items={TABS.map((t) => ({
						key: t.key,
						label: `${t.label}${counts ? ` (${(counts[t.key || "All"] ?? 0).toLocaleString()})` : ""}`,
					}))}
				/>
				<JobsFilters list={list} />
				{list.error && (
					<Alert
						type="error"
						showIcon
						message="Could not load the jobs"
						description={list.error.message}
						style={{ marginTop: tokens.space.lg }}
					/>
				)}
				<Table
					style={{ marginTop: tokens.space.lg }}
					rowKey="name"
					columns={jobsColumns}
					dataSource={list.data?.jobs}
					loading={list.isLoading}
					// only the rows scroll; the header, tabs and paging stay in view
					scroll={{ x: "max-content", y: "calc(100vh - 470px)" }}
					onRow={(row) => ({
						onClick: () => openJob(row.name),
						style: { cursor: "pointer" },
					})}
					locale={{ emptyText: "No jobs match. Try another tab or clear the filters." }}
					pagination={{
						current: list.page,
						pageSize: list.pageSize,
						total: list.data?.total ?? 0,
						showSizeChanger: true,
						pageSizeOptions: [10, 20, 50],
						showTotal: (total, [from, to]) =>
							`${from}–${to} of ${total.toLocaleString()} jobs`,
						onChange: (page, size) => list.update({ page, size }),
					}}
				/>
			</Card>
		</Flex>
	);
}
