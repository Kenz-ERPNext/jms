// One card on the Reports page: the report's icon (in its group's colour), name and
// the question it answers, on one row. Opens with a click, Enter or Space.

import {
	AlertOutlined,
	AuditOutlined,
	BarChartOutlined,
	BookOutlined,
	CalendarOutlined,
	ClockCircleOutlined,
	DollarOutlined,
	FileDoneOutlined,
	FundOutlined,
	PieChartOutlined,
	ProfileOutlined,
	RightOutlined,
	RiseOutlined,
	ShopOutlined,
	SyncOutlined,
	TeamOutlined,
	WalletOutlined,
} from "@ant-design/icons";
import { Card, Flex, Typography } from "antd";
import type { ReactNode } from "react";

import { tokens } from "@/theme/tokens";

import type { ReportItem } from "./reportList";

const { space, font, radius } = tokens;

export const ICON: Record<string, ReactNode> = {
	"Job Status Report": <FileDoneOutlined />,
	"Work In Progress": <SyncOutlined />,
	"Pending Tasks": <ClockCircleOutlined />,
	"Outsourcing Pending Tasks": <ShopOutlined />,
	"Employee Task Report": <TeamOutlined />,
	"Cash Collection": <DollarOutlined />,
	"Job Collection Report": <AuditOutlined />,
	"Outstanding Receivable": <AlertOutlined />,
	"Job Supplier Payment Report": <WalletOutlined />,
	"Day Business Summary Oasis": <CalendarOutlined />,
	"General Ledger": <ProfileOutlined />,
	"Journal Entries": <BookOutlined />,
	"Job Profitability": <FundOutlined />,
	"Job Gross Profit": <PieChartOutlined />,
	"Closed Job Profit": <RiseOutlined />,
	"Monthly Profit": <BarChartOutlined />,
};

export default function ReportCard({
	r,
	tint,
	onOpen,
}: {
	r: ReportItem;
	tint: string;
	onOpen: () => void;
}) {
	return (
		<Card
			hoverable
			className="sbm-lift sbm-report-card"
			role="button"
			tabIndex={0}
			aria-label={`Open ${r.label ?? r.name}`}
			style={{ height: "100%" }}
			styles={{ body: { height: "100%", padding: `${space.md}px ${space.lg}px` } }}
			onClick={onOpen}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onOpen();
				}
			}}
		>
			<Flex gap={space.md} align="center" style={{ height: "100%" }}>
				<span
					aria-hidden
					style={{
						flex: "none",
						display: "grid",
						placeItems: "center",
						width: 40,
						height: 40,
						borderRadius: radius.md,
						fontSize: font.size.lg,
						color: tint,
						background: `${tint}14`,
					}}
				>
					{ICON[r.name]}
				</span>
				<div style={{ minWidth: 0, flex: 1 }}>
					<Typography.Text strong ellipsis style={{ display: "block" }}>
						{r.label ?? r.name}
					</Typography.Text>
					<Typography.Text
						type="secondary"
						ellipsis
						style={{ display: "block", fontSize: font.size.sm }}
					>
						{r.hint}
					</Typography.Text>
				</div>
				<RightOutlined aria-hidden className="sbm-report-open" />
			</Flex>
		</Card>
	);
}
