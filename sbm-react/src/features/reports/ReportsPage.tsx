// Reports, like ERPNext's workspace shortcuts but quicker to read: each group (Work,
// Money, Profit) says what it is about, and each card has its own icon and the
// question it answers. A search box narrows the cards. A card opens the report in a
// large modal (a list such as Journal Entries too); the open report and its filters are in the URL
// (?report=<slug>&filters=...), so it can be bookmarked. A topic switch shows one
// group, and the reports this browser opened last are one click away.

import {
	HistoryOutlined,
	RiseOutlined,
	SearchOutlined,
	ToolOutlined,
	WalletOutlined,
} from "@ant-design/icons";
import { Button, Col, Empty, Flex, Input, Modal, Row, Segmented, Tag, Typography } from "antd";
import { useState, type ReactNode } from "react";
import { useSearchParams } from "react-router";

import { MasterList } from "@/features/masters/MasterListPage";
import { BRAND_GRADIENT } from "@/lib/brand";
import { tokens } from "@/theme/tokens";

import { readRecent, rememberRecent } from "./recentReports";
import ReportCard, { ICON } from "./ReportCard";
import { myReportGroups, reportBySlug, reportSlug, type ReportItem } from "./reportList";
import ReportView from "./ReportView";

const { color, space, font, radius } = tokens;
const GROUP: Record<string, { icon: ReactNode; tint: string }> = {
	Work: { icon: <ToolOutlined />, tint: color.info },
	Money: { icon: <WalletOutlined />, tint: color.primary },
	Profit: { icon: <RiseOutlined />, tint: color.accent },
};

export default function ReportsPage() {
	const [params, setParams] = useSearchParams();
	const [search, setSearch] = useState("");
	const [topic, setTopic] = useState("All");
	const [recent, setRecent] = useState(readRecent);
	const report = reportBySlug(params.get("report") ?? undefined);
	const q = search.trim().toLowerCase();
	const mine = myReportGroups();
	const groups = mine
		.filter((g) => topic === "All" || g.title === topic)
		.map((g) => ({
			...g,
			shown: g.reports.filter(
				(r) => !q || `${r.label ?? ""} ${r.name} ${r.hint}`.toLowerCase().includes(q),
			),
		}))
		.filter((g) => g.shown.length);
	const total = mine.reduce((n, g) => n + g.reports.length, 0);
	// recent cards only for reports this user may still open
	const recentShown = recent.flatMap((slug) => {
		const g = mine.find((x) => x.reports.some((r) => reportSlug(r.name) === slug));
		const r = g?.reports.find((x) => reportSlug(x.name) === slug);
		return g && r ? [{ r, tint: GROUP[g.title].tint }] : [];
	});
	const open = (r: ReportItem) => {
		const slug = reportSlug(r.name);
		rememberRecent(slug);
		setRecent(readRecent());
		setParams({ report: slug });
	};

	return (
		<Flex vertical gap={space.xl}>
			<div
				style={{
					background: BRAND_GRADIENT(),
					borderRadius: radius.lg,
					padding: `${space.xl}px ${space.xl}px`,
					color: color.surface,
				}}
			>
				<Flex justify="space-between" align="center" wrap gap={space.lg}>
					<div>
						<Typography.Title level={3} style={{ margin: 0, color: color.surface }}>
							Reports
						</Typography.Title>
						<Typography.Text style={{ color: color.primaryBg }}>
							{total} reports to answer your questions on work, money and profit.
						</Typography.Text>
					</div>
					<Input
						allowClear
						size="large"
						prefix={<SearchOutlined style={{ color: color.textMuted }} />}
						placeholder="Find a report, e.g. profit or pending"
						style={{ width: "min(100%, 340px)" }}
						onChange={(e) => setSearch(e.target.value)}
					/>
				</Flex>
			</div>

			{mine.length > 1 && (
				<Segmented
					value={topic}
					onChange={(v) => setTopic(String(v))}
					options={[
						{ value: "All", label: `All (${total})` },
						...mine.map((g) => ({
							value: g.title,
							label: (
								<Flex gap={space.xs} align="center">
									<span style={{ color: GROUP[g.title].tint }}>
										{GROUP[g.title].icon}
									</span>
									{g.title} ({g.reports.length})
								</Flex>
							),
						})),
					]}
					style={{ alignSelf: "flex-start", maxWidth: "100%", overflowX: "auto" }}
				/>
			)}

			{!q && topic === "All" && recentShown.length > 0 && (
				<div>
					<Flex align="center" gap={space.sm} style={{ marginBottom: space.md }}>
						<HistoryOutlined style={{ color: color.textMuted }} />
						<Typography.Title level={5} style={{ margin: 0 }}>
							Recently opened
						</Typography.Title>
					</Flex>
					<Flex wrap gap={space.sm}>
						{recentShown.map(({ r, tint }) => (
							<Button
								key={r.name}
								icon={<span style={{ color: tint }}>{ICON[r.name]}</span>}
								onClick={() => open(r)}
							>
								{r.label ?? r.name}
							</Button>
						))}
					</Flex>
				</div>
			)}

			{groups.map((g) => (
				<section key={g.title}>
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
							<Col key={r.name} xs={24} md={12} xl={8} xxl={6}>
								<ReportCard
									r={r}
									tint={GROUP[g.title].tint}
									onOpen={() => open(r)}
								/>
							</Col>
						))}
					</Row>
				</section>
			))}
			{!groups.length && (
				<Empty
					description={q ? `No report matches "${search.trim()}"` : "No reports here"}
				/>
			)}
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
