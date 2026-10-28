// Reports, like ERPNext's workspace shortcuts but quicker to read: each group (Work,
// Money, Profit) says what it is about, and each card has its own icon and the
// question it answers. A search box narrows the cards. A card opens the report in a
// large modal (a list such as Journal Entries too); the open report and its filters are in the URL
// (?report=<slug>&filters=...), so it can be bookmarked.

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
	RiseOutlined,
	ShopOutlined,
	SyncOutlined,
	TeamOutlined,
	ToolOutlined,
	WalletOutlined,
} from "@ant-design/icons";
import { Card, Col, Empty, Flex, Input, Modal, Row, Tag, Typography } from "antd";
import { useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";

import { MasterList } from "@/features/masters/MasterListPage";
import { tokens } from "@/theme/tokens";

import { myReportGroups, reportBySlug, reportSlug, type ReportItem } from "./reportList";
import ReportView from "./ReportView";

const { color, space, font, radius } = tokens;
const GROUP: Record<string, { icon: ReactNode; tint: string }> = {
	Work: { icon: <ToolOutlined />, tint: color.info },
	Money: { icon: <WalletOutlined />, tint: color.primary },
	Profit: { icon: <RiseOutlined />, tint: color.accent },
};
const ICON: Record<string, ReactNode> = {
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
	"Journal Entries": <BookOutlined />,
	"Job Profitability": <FundOutlined />,
	"Job Gross Profit": <PieChartOutlined />,
	"Closed Job Profit": <RiseOutlined />,
	"Monthly Profit": <BarChartOutlined />,
};

function ReportCard({ r, tint, onOpen }: { r: ReportItem; tint: string; onOpen: () => void }) {
	return (
		<Card hoverable className="sbm-lift" style={{ height: "100%" }} onClick={onOpen}>
			<Flex gap={space.md} align="center">
				<span
					style={{
						flex: "none",
						display: "grid",
						placeItems: "center",
						width: 44,
						height: 44,
						borderRadius: radius.lg,
						fontSize: font.size.xl,
						color: tint,
						background: `${tint}1A`,
					}}
				>
					{ICON[r.name]}
				</span>
				<div style={{ minWidth: 0 }}>
					<Typography.Text strong style={{ fontSize: font.size.lg }}>
						{r.label ?? r.name}
					</Typography.Text>
					<Typography.Text type="secondary" style={{ display: "block" }}>
						{r.hint}
					</Typography.Text>
				</div>
			</Flex>
		</Card>
	);
}

export default function ReportsPage() {
	const [params, setParams] = useSearchParams();
	const [search, setSearch] = useState("");
	const report = reportBySlug(params.get("report") ?? undefined);
	const q = search.trim().toLowerCase();
	const groups = myReportGroups()
		.map((g) => ({
			...g,
			shown: g.reports.filter((r) => !q || `${r.name} ${r.hint}`.toLowerCase().includes(q)),
		}))
		.filter((g) => g.shown.length);
	const open = (r: ReportItem) => setParams({ report: reportSlug(r.name) });

	return (
		<Flex vertical gap={space.lg}>
			<Flex justify="space-between" align="center" wrap gap={space.md}>
				<div>
					<Typography.Title level={3} style={{ margin: 0 }}>
						Reports
					</Typography.Title>
					<Typography.Text type="secondary">
						Pick the question you want answered.
					</Typography.Text>
				</div>
				<Input.Search
					allowClear
					placeholder="Find a report"
					style={{ width: 280 }}
					onChange={(e) => setSearch(e.target.value)}
				/>
			</Flex>
			{groups.map((g) => (
				<div key={g.title}>
					<Flex align="center" gap={space.sm} wrap style={{ marginBottom: space.md }}>
						<span style={{ color: GROUP[g.title].tint, fontSize: font.size.lg }}>
							{GROUP[g.title].icon}
						</span>
						<Typography.Title level={5} style={{ margin: 0 }}>
							{g.title}
						</Typography.Title>
						<Tag bordered={false}>{g.shown.length}</Tag>
						<Typography.Text type="secondary">{g.about}</Typography.Text>
					</Flex>
					<Row gutter={[space.md, space.md]}>
						{g.shown.map((r) => (
							<Col key={r.name} xs={24} md={12} xl={8}>
								<ReportCard
									r={r}
									tint={GROUP[g.title].tint}
									onOpen={() => open(r)}
								/>
							</Col>
						))}
					</Row>
				</div>
			))}
			{!groups.length && <Empty description="No report matches" />}
			<Modal
				open={!!report}
				title={
					report && (
						<>
							{report.label ?? report.name}
							<Typography.Text
								type="secondary"
								style={{ marginLeft: space.sm, fontWeight: 400 }}
							>
								{report.hint}
							</Typography.Text>
						</>
					)
				}
				centered
				width="92vw"
				style={{ maxWidth: 1500 }}
				footer={null}
				onCancel={() => setParams({})}
				destroyOnHidden
			>
				{report?.list ? (
					<MasterList key={report.list} slug={report.list} inModal />
				) : (
					report && <ReportView key={report.name} report={report.name} />
				)}
			</Modal>
		</Flex>
	);
}
