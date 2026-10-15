// Top of the Job page: number, title, status and stage, who it is for, and the
// buttons: the one Next step, the other actions in a menu, Print, ERPNext.

import { DownOutlined, ExportOutlined, PrinterOutlined } from "@ant-design/icons";
import { Button, Dropdown, Flex, Space, Typography, type MenuProps } from "antd";

import StatusPill, { StagePill } from "@/components/StatusPill";
import { formatDate } from "@/lib/format";
import { deskPath, openPrint } from "@/lib/links";
import { ADMIN_ROLES, hasAnyRole } from "@/lib/roles";
import { tokens } from "@/theme/tokens";

import { ACTION_TEXT, GROUP_TITLE, type ActionGroup } from "./jobActions";
import type { JobDoc, JobState } from "./useJob";

interface JobHeaderProps {
	job: JobDoc;
	state?: JobState;
	onAction: (key: string) => void;
}

export default function JobHeader({ job, state, onAction }: JobHeaderProps) {
	const next = state?.next_action;
	const others = (state?.actions ?? []).map((a) => a.key).filter((k) => k !== next);
	const groups = (["create", "job"] as ActionGroup[])
		.map((group) => ({
			type: "group" as const,
			label: GROUP_TITLE[group],
			children: others
				.filter((k) => ACTION_TEXT[k]?.group === group)
				.map((k) => ({ key: k, label: ACTION_TEXT[k].label, danger: k === "cancel" })),
		}))
		.filter((g) => g.children.length);
	const menu: MenuProps = { items: groups, onClick: ({ key }) => onAction(key) };

	return (
		<Flex justify="space-between" align="start" wrap gap={tokens.space.md}>
			<div>
				<Space wrap size={tokens.space.sm}>
					<Typography.Title level={3} style={{ margin: 0 }}>
						{job.name}
					</Typography.Title>
					<StatusPill value={job.status} />
					{state && job.status !== "Closed" && <StagePill value={state.stage} />}
				</Space>
				<div>
					<Typography.Text strong>{job.job_title}</Typography.Text>
					<Typography.Text type="secondary">
						{" · "}
						{job.customer_name || job.customer}
						{job.customer_mobile ? ` · ${job.customer_mobile}` : ""}
						{job.expected_completion_date
							? ` · due ${formatDate(job.expected_completion_date)}`
							: ""}
					</Typography.Text>
				</div>
			</div>
			<Space wrap>
				{hasAnyRole(ADMIN_ROLES) && (
					<Button icon={<ExportOutlined />} href={deskPath("Job", job.name)}>
						ERPNext
					</Button>
				)}
				<Button icon={<PrinterOutlined />} onClick={() => openPrint(job.name)}>
					Print
				</Button>
				{groups.length > 0 && (
					<Dropdown menu={menu} trigger={["click"]}>
						<Button>
							More actions <DownOutlined />
						</Button>
					</Dropdown>
				)}
				{next && ACTION_TEXT[next] && (
					<Button type="primary" onClick={() => onAction(next)}>
						Next: {ACTION_TEXT[next].label}
					</Button>
				)}
			</Space>
		</Flex>
	);
}
