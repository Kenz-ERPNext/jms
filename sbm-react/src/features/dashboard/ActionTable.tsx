// The jobs of one "needs action" list. Columns depend on the list: amount to
// invoice, amount to receive, or how late. Clicking a job opens it in the job modal.

import { Table, Typography, type TableColumnsType } from "antd";

import { daysAgo, formatDate, formatMoney } from "@/lib/format";
import { useOpenJob } from "@/features/job-form/JobModalProvider";
import { tokens } from "@/theme/tokens";

import type { ListKey } from "./dashboardText";
import type { JobRow } from "./useDashboard";

const small = { fontSize: tokens.font.size.sm };

const jobColumn = {
	title: "Job",
	dataIndex: "name",
	render: (name: string, row: JobRow) => (
		<>
			<Typography.Text strong style={{ color: tokens.color.primary, whiteSpace: "nowrap" }}>
				{name}
			</Typography.Text>
			<Typography.Text type="secondary" style={{ ...small, marginLeft: tokens.space.sm }}>
				{row.job_title}
			</Typography.Text>
		</>
	),
};

// Hidden on phones: job, customer and amount do not fit side by side there.
const customerColumn = {
	title: "Customer",
	dataIndex: "customer_name",
	ellipsis: true,
	responsive: ["md" as const],
};

const money = (title: string, dataIndex: keyof JobRow) => ({
	title,
	dataIndex,
	align: "right" as const,
	render: (v: number) => (
		<Typography.Text strong style={{ whiteSpace: "nowrap" }}>
			{formatMoney(v)}
		</Typography.Text>
	),
});

const COLUMNS: Record<ListKey, TableColumnsType<JobRow>> = {
	to_invoice: [jobColumn, customerColumn, money("Amount to invoice", "net_amount")],
	to_collect: [jobColumn, customerColumn, money("Amount to receive", "to_collect")],
	overdue: [
		jobColumn,
		customerColumn,
		{
			title: "Was due",
			dataIndex: "expected_completion_date",
			render: (v: string) => (
				<>
					{formatDate(v)}{" "}
					<Typography.Text type="danger" style={small}>
						({daysAgo(v)} days late)
					</Typography.Text>
				</>
			),
		},
		{
			title: "Tasks done",
			align: "right",
			render: (_, r) => `${r.tasks_done} of ${r.tasks_total}`,
		},
	],
};

interface ActionTableProps {
	listKey: ListKey;
	rows: JobRow[];
	empty: string;
}

export default function ActionTable({ listKey, rows, empty }: ActionTableProps) {
	const openJob = useOpenJob();
	return (
		<Table<JobRow>
			onRow={(row) => ({ onClick: () => openJob(row.name), style: { cursor: "pointer" } })}
			size="middle"
			rowKey="name"
			pagination={false}
			dataSource={rows}
			columns={COLUMNS[listKey]}
			locale={{ emptyText: empty }}
			scroll={{ x: true }}
		/>
	);
}
