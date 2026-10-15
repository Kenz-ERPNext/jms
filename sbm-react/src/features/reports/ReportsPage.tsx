// Reports, like ERPNext's workspace shortcuts: the reports as cards under Work, Money
// and Profit. A card opens the report in a large modal. The open report and its
// filters are in the URL (?report=<slug>&filters=...), so it can be bookmarked.

import { DollarOutlined, RiseOutlined, ToolOutlined } from "@ant-design/icons";
import { Card, Col, Flex, Modal, Row, Typography } from "antd";
import type { ReactNode } from "react";
import { useSearchParams } from "react-router";

import { tokens } from "@/theme/tokens";

import { REPORT_GROUPS, reportBySlug, reportHint, reportSlug } from "./reportList";
import ReportView from "./ReportView";

const { color, space, font, radius } = tokens;
const GROUP: Record<string, { icon: ReactNode; tint: string }> = {
	Work: { icon: <ToolOutlined />, tint: color.info },
	Money: { icon: <DollarOutlined />, tint: color.primary },
	Profit: { icon: <RiseOutlined />, tint: color.accent },
};

export default function ReportsPage() {
	const [params, setParams] = useSearchParams();
	const report = reportBySlug(params.get("report") ?? undefined);

	return (
		<Flex vertical gap={space.lg}>
			<div>
				<Typography.Title level={3} style={{ margin: 0 }}>
					Reports
				</Typography.Title>
				<Typography.Text type="secondary">Click a report to open it.</Typography.Text>
			</div>
			{REPORT_GROUPS.map((g) => (
				<Card key={g.title} title={g.title} size="small">
					<Row gutter={[space.md, space.md]}>
						{g.reports.map((r) => (
							<Col key={r.name} xs={24} sm={12} lg={8} xxl={6}>
								<Card
									size="small"
									hoverable
									className="sbm-lift"
									style={{ height: "100%" }}
									onClick={() => setParams({ report: reportSlug(r.name) })}
								>
									<Flex gap={space.md} align="center">
										<span
											style={{
												fontSize: font.size.xl,
												color: GROUP[g.title].tint,
												background: `${GROUP[g.title].tint}1A`,
												borderRadius: radius.md,
												padding: `${space.xs}px ${space.sm}px`,
											}}
										>
											{GROUP[g.title].icon}
										</span>
										<div style={{ minWidth: 0 }}>
											<Typography.Text strong>{r.name}</Typography.Text>
											<Typography.Text
												type="secondary"
												style={{
													display: "block",
													fontSize: font.size.sm,
												}}
											>
												{r.hint}
											</Typography.Text>
										</div>
									</Flex>
								</Card>
							</Col>
						))}
					</Row>
				</Card>
			))}
			<Modal
				open={!!report}
				title={
					report && (
						<>
							{report}
							<Typography.Text
								type="secondary"
								style={{ marginLeft: space.sm, fontWeight: 400 }}
							>
								{reportHint(report)}
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
				{report && <ReportView key={report} report={report} />}
			</Modal>
		</Flex>
	);
}
