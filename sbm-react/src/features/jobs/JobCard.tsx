// One job as a card (Cards view of the Jobs list): a header tinted in the colour of where
// the job is, the customer with an avatar, the amount and a task ring. A click opens the job.

import {
	CalendarOutlined,
	CheckSquareOutlined,
	FlagFilled,
	RightOutlined,
} from "@ant-design/icons";
import { Avatar, Button, Card, Flex, Progress, Tag, Tooltip, Typography } from "antd";
import { useNavigate } from "react-router";

import { statusColor } from "@/components/StatusPill";
import { stageLabel } from "@/config/stages";
import { useOpenJob } from "@/features/job-form/JobModalProvider";
import { formatDate, formatMoney } from "@/lib/format";
import { jobPath } from "@/lib/links";
import { tokens } from "@/theme/tokens";

import { avatarColor, CARD_COLORS, initials, PRIORITY_COLORS } from "./jobCardColors";
import type { JobListRow } from "./useJobsList";

const { color, space, font, radius } = tokens;
const DEAD = ["Closed", "Cancelled", "Canceled", "Rejected"];
export default function JobCard({ job }: { job: JobListRow }) {
	const openJob = useOpenJob();
	const navigate = useNavigate();
	const dead = DEAD.includes(job.status);
	const done = dead || job.status === "Completed";
	const key = dead ? job.status : job.stage || job.status;
	const accent = CARD_COLORS[key] ?? statusColor(key);
	const priority = job.priority && PRIORITY_COLORS[job.priority];
	const customer = job.customer_name || job.customer || "";
	const percent = job.tasks_total ? Math.round((job.tasks_done / job.tasks_total) * 100) : 0;
	const owing = job.to_collect > 0;

	return (
		<Card
			hoverable
			className="sbm-lift"
			onClick={() => openJob(job.name)}
			style={{
				height: "100%",
				overflow: "hidden",
				background: `${accent}0D`,
				border: `1px solid ${accent}`,
			}}
			styles={{
				body: { padding: 0, display: "flex", flexDirection: "column", height: "100%" },
			}}
		>
			{/* header: job no, type and where it is, on the job's colour */}
			<div
				style={{
					background: `linear-gradient(135deg, ${accent}40 0%, ${accent}14 100%)`,
					borderBottom: `1px solid ${accent}40`,
					padding: `${space.md}px ${space.lg}px`,
				}}
			>
				<Flex justify="space-between" align="center" gap={space.sm}>
					<Typography.Text
						strong
						style={{ color: accent, fontSize: font.size.lg, whiteSpace: "nowrap" }}
					>
						{job.name}
					</Typography.Text>
					{/* solid pill in the card's colour */}
					<Tag
						bordered={false}
						style={{
							color: color.surface,
							background: accent,
							fontWeight: 600,
							marginInlineEnd: 0,
						}}
					>
						{dead ? job.status : stageLabel(key)}
					</Tag>
				</Flex>
				<Flex gap={space.xs} wrap style={{ marginTop: space.xs }}>
					{job.job_type && (
						<Tag
							bordered={false}
							style={{ background: color.surface, marginInlineEnd: 0 }}
						>
							{job.job_type}
						</Tag>
					)}
					{/* a finished job needs no priority */}
					{!done && priority && (
						<Tag
							bordered={false}
							icon={<FlagFilled />}
							style={{
								color: color.surface,
								background: priority,
								marginInlineEnd: 0,
							}}
						>
							{job.priority}
						</Tag>
					)}
				</Flex>
			</div>

			<Flex vertical gap={space.md} style={{ padding: space.lg, flex: 1 }}>
				<Typography.Paragraph
					ellipsis={{ rows: 2, tooltip: job.job_title }}
					style={{ margin: 0, fontWeight: 600, fontSize: font.size.md }}
				>
					{job.job_title || "—"}
				</Typography.Paragraph>

				{/* customer and dates */}
				<Flex gap={space.sm} align="center" style={{ minWidth: 0 }}>
					<Avatar style={{ background: avatarColor(customer), flexShrink: 0 }}>
						{initials(customer) || "?"}
					</Avatar>
					<div style={{ minWidth: 0 }}>
						<Typography.Text strong ellipsis style={{ display: "block" }}>
							{customer || "—"}
						</Typography.Text>
						<Typography.Text
							type={job.overdue ? "danger" : "secondary"}
							style={{ fontSize: font.size.sm }}
						>
							<CalendarOutlined /> {formatDate(job.start_date) || "—"} →{" "}
							{formatDate(job.expected_completion_date) || "—"}
							{job.overdue && <strong> · late</strong>}
						</Typography.Text>
					</div>
				</Flex>

				{/* amount and tasks */}
				<Flex
					justify="space-between"
					align="center"
					style={{
						marginTop: "auto",
						background: color.surface,
						borderRadius: radius.md,
						padding: `${space.sm}px ${space.md}px`,
					}}
				>
					<div>
						<div
							style={{ fontSize: font.size.xl, fontWeight: 700, color: color.text }}
						>
							{formatMoney(job.net_amount)}
						</div>
						<Typography.Text
							style={{
								fontSize: font.size.sm,
								color: owing ? color.warning : color.success,
							}}
						>
							{owing
								? `${formatMoney(job.to_collect)} to receive`
								: "Nothing to receive"}
						</Typography.Text>
					</div>
					<Tooltip title={`${job.tasks_done} of ${job.tasks_total} tasks done`}>
						<Progress
							type="circle"
							size={48}
							percent={percent}
							strokeColor={percent === 100 ? color.success : color.accent}
							format={() => (
								<span style={{ fontSize: font.size.sm, fontWeight: 600 }}>
									{job.tasks_done}/{job.tasks_total}
								</span>
							)}
						/>
					</Tooltip>
				</Flex>
			</Flex>

			{/* footer: the tasks link (the card itself opens the job) */}
			<Flex
				justify="space-between"
				style={{
					borderTop: `1px solid ${accent}40`,
					padding: `${space.xs}px ${space.sm}px`,
				}}
			>
				<Button
					type="text"
					size="small"
					icon={<CheckSquareOutlined />}
					onClick={(e) => {
						e.stopPropagation();
						navigate(`${jobPath(job.name)}?tab=tasks`);
					}}
				>
					View Tasks
				</Button>
				<Button type="link" size="small">
					Open Job <RightOutlined />
				</Button>
			</Flex>
		</Card>
	);
}
