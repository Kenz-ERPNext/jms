// The four big money numbers at the top, each with an icon. Expenses and
// outsourcing are shown as a small line under Net Profit. Only totals the server
// sends (JMS Settings) appear.

import {
	ClockCircleOutlined,
	FileDoneOutlined,
	RiseOutlined,
	WalletOutlined,
} from "@ant-design/icons";
import { Card, Col, Flex, Grid, Row, Typography } from "antd";
import type { ReactNode } from "react";

import { formatMoney } from "@/lib/format";
import { tokens } from "@/theme/tokens";

import { COST_LABELS, KPIS } from "./dashboardText";

const { color, space, font, radius } = tokens;

const ICONS: Record<string, { icon: ReactNode; tint: string }> = {
	total_job_amount: { icon: <FileDoneOutlined />, tint: color.info },
	total_received: { icon: <WalletOutlined />, tint: color.success },
	outstanding: { icon: <ClockCircleOutlined />, tint: color.warning },
	net_profit: { icon: <RiseOutlined />, tint: color.surface },
};

export default function KpiCards({ money }: { money: { key: string; value: number }[] }) {
	const value = Object.fromEntries(money.map((m) => [m.key, m.value]));
	// smaller numbers on a phone, so an amount stays on one line
	const { md } = Grid.useBreakpoint();
	const kpis = KPIS.filter((k) => k.key in value);
	const costs = Object.keys(COST_LABELS).filter((k) => k in value);
	if (!kpis.length) return null;

	return (
		<Row gutter={[space.lg, space.lg]}>
			{kpis.map(({ key, label, hint }) => {
				const profit = key === "net_profit";
				const muted = profit ? color.primaryBg : color.textMuted;
				const { icon, tint } = ICONS[key] ?? { icon: null, tint: color.textMuted };
				return (
					<Col key={key} xs={24} sm={12} xl={6}>
						<Card
							className="sbm-lift"
							style={{
								height: "100%",
								background: profit ? color.primary : color.surface,
							}}
						>
							<Flex justify="space-between" align="start" gap={space.md}>
								<div style={{ minWidth: 0 }}>
									<Typography.Text style={{ color: muted }}>
										{label}
									</Typography.Text>
									<Typography.Title
										level={md ? 2 : 3}
										style={{
											margin: `${space.xs}px 0`,
											color: profit ? color.surface : color.text,
											// the amount stays on one line and shrinks on narrow cards
											whiteSpace: "nowrap",
											fontSize: "clamp(18px, 1.5vw, 30px)",
										}}
									>
										{formatMoney(value[key])}
									</Typography.Title>
									<Typography.Text
										style={{ fontSize: font.size.sm, color: muted }}
									>
										{profit && costs.length
											? costs
													.map(
														(c) =>
															`${COST_LABELS[c]} ${formatMoney(value[c])}`,
													)
													.join(" · ")
											: hint}
									</Typography.Text>
								</div>
								{/* the icon only helps scanning; the label says what the number is */}
								<Flex
									aria-hidden
									align="center"
									justify="center"
									style={{
										flex: "none",
										width: 44,
										height: 44,
										borderRadius: radius.lg,
										fontSize: font.size.xl,
										color: tint,
										background: profit
											? "rgba(255,255,255,0.15)"
											: `${tint}1A`,
									}}
								>
									{icon}
								</Flex>
							</Flex>
						</Card>
					</Col>
				);
			})}
		</Row>
	);
}
