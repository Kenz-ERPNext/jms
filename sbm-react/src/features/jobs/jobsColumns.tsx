// Columns of the Jobs list: only what is needed to find a job and see where it is.
// A row opens the job; the Actions button has the job's money actions.

import { Typography, type TableColumnsType } from "antd";

import StatusPill, { StagePill } from "@/components/StatusPill";
import RowActions from "@/features/job-actions/RowActions";
import { formatDate, formatMoney } from "@/lib/format";
import { tokens } from "@/theme/tokens";

import type { JobListRow } from "./useJobsList";

const small = { fontSize: tokens.font.size.sm };
const nowrap = { whiteSpace: "nowrap" as const };
const DEAD = ["Closed", "Cancelled", "Canceled", "Rejected"];

export const jobsColumns: TableColumnsType<JobListRow> = [
	{
		title: "Job",
		dataIndex: "name",
		render: (name: string, row) => (
			<div>
				<Typography.Text strong style={{ color: tokens.color.primary, ...nowrap }}>
					{name}
				</Typography.Text>
				<br />
				<Typography.Text type="secondary" style={small}>
					{row.job_title}
				</Typography.Text>
			</div>
		),
	},
	{
		title: "Customer",
		dataIndex: "customer_name",
		ellipsis: true,
		render: (v: string, row) => v || row.customer,
	},
	{
		// one column: where the job is (a closed or cancelled job shows that instead)
		title: "Status",
		dataIndex: "stage",
		render: (stage: string, row) =>
			DEAD.includes(row.status) ? (
				<StatusPill value={row.status} />
			) : (
				<StagePill value={stage} />
			),
	},
	{
		title: "Amount",
		dataIndex: "net_amount",
		align: "right",
		render: (v: number) => <span style={nowrap}>{formatMoney(v)}</span>,
	},
	{
		title: "To receive",
		dataIndex: "to_collect",
		align: "right",
		responsive: ["sm"],
		render: (v: number) =>
			v > 0 ? (
				<Typography.Text strong style={{ color: tokens.color.warning, ...nowrap }}>
					{formatMoney(v)}
				</Typography.Text>
			) : (
				<Typography.Text type="secondary">—</Typography.Text>
			),
	},
	{
		title: "Due",
		dataIndex: "expected_completion_date",
		responsive: ["md"],
		render: (v: string, row) =>
			v ? (
				<Typography.Text type={row.overdue ? "danger" : undefined} style={nowrap}>
					{formatDate(v)}
					{row.overdue && <span style={small}> · late</span>}
				</Typography.Text>
			) : null,
	},
	{
		title: "Actions",
		key: "actions",
		align: "right",
		width: 170,
		render: (_, row) => <RowActions job={row.name} status={row.status} />,
	},
];
