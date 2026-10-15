// One change in the Activity Log: an icon for the action, "<who> <did> <document>
// for <party>", the job, the time, and the amount on the right. Clicking it shows
// what changed (one open at a time; the page keeps which).

import {
	CheckOutlined,
	CloseOutlined,
	DeleteOutlined,
	EditOutlined,
	PlusOutlined,
} from "@ant-design/icons";
import { Flex, Typography } from "antd";
import dayjs from "dayjs";
import type { ReactNode } from "react";

import { formatMoney } from "@/lib/format";
import { deskPath } from "@/lib/links";
import { tokens } from "@/theme/tokens";

const { space, font, color, radius } = tokens;

export interface LogRow {
	name: string;
	creation: string;
	action: string;
	reference_doctype: string;
	reference_name: string;
	job?: string;
	party?: string;
	amount?: number;
	changed_by_name?: string;
	details?: string;
}

export const ACTION_LOOK: Record<string, { icon: ReactNode; tint: string }> = {
	Created: { icon: <PlusOutlined />, tint: color.info },
	Submitted: { icon: <CheckOutlined />, tint: color.success },
	Edited: { icon: <EditOutlined />, tint: color.warning },
	"Edited after Submit": { icon: <EditOutlined />, tint: color.warning },
	Cancelled: { icon: <CloseOutlined />, tint: color.danger },
	Deleted: { icon: <DeleteOutlined />, tint: color.danger },
};

interface Props {
	row: LogRow;
	open: boolean;
	onToggle: () => void;
	onJob: (job: string) => void;
}

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation();

export default function ActivityItem({ row, open, onToggle, onJob }: Props) {
	const look = ACTION_LOOK[row.action] ?? { icon: <EditOutlined />, tint: color.textMuted };
	const small = { fontSize: font.size.sm };
	return (
		<div
			className="sbm-log-row"
			onClick={row.details ? onToggle : undefined}
			style={{ cursor: row.details ? "pointer" : "default" }}
		>
			<Flex gap={space.md} align="flex-start">
				<span
					style={{
						flex: "none",
						width: 32,
						height: 32,
						borderRadius: "50%",
						display: "grid",
						placeItems: "center",
						color: look.tint,
						background: `${look.tint}1A`,
					}}
				>
					{look.icon}
				</span>
				<div style={{ flex: 1, minWidth: 0 }}>
					<Typography.Text>
						<strong>{row.changed_by_name || "Someone"}</strong>{" "}
						{row.action.toLowerCase()} {row.reference_doctype}{" "}
						<a
							href={deskPath(row.reference_doctype, row.reference_name)}
							target="_blank"
							rel="noreferrer"
							onClick={stop}
							style={{ fontWeight: 600 }}
						>
							{row.reference_name}
						</a>
						{row.party && <> for {row.party}</>}
					</Typography.Text>
					<Flex gap={space.sm} wrap style={{ marginTop: 2 }}>
						<Typography.Text style={{ ...small, color: look.tint }}>
							{row.action}
						</Typography.Text>
						<Typography.Text type="secondary" style={small}>
							· {dayjs(row.creation).format("hh:mm A")}
						</Typography.Text>
						{row.job && (
							<Typography.Text type="secondary" style={small}>
								· <a onClick={(e) => (stop(e), onJob(row.job!))}>{row.job}</a>
							</Typography.Text>
						)}
						{row.details && (
							<Typography.Text type="secondary" style={small}>
								· {open ? "Hide changes ▲" : "Show changes ▼"}
							</Typography.Text>
						)}
					</Flex>
					{open && row.details && (
						<Typography.Paragraph
							style={{
								...small,
								whiteSpace: "pre-wrap",
								margin: `${space.sm}px 0 0`,
								padding: space.sm,
								background: color.bg,
								borderRadius: radius.md,
							}}
						>
							{row.details}
						</Typography.Paragraph>
					)}
				</div>
				{!!row.amount && (
					<Typography.Text strong style={{ whiteSpace: "nowrap" }}>
						{formatMoney(row.amount)}
					</Typography.Text>
				)}
			</Flex>
		</div>
	);
}
