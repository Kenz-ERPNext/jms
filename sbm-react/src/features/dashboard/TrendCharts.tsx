// Last six months at a glance: money received from customers and new jobs, each
// in its own chart (two different units never share one axis). The total of the
// period is the headline of each card; the current month is marked "so far".

import { Card, Col, Row, Typography } from "antd";
import dayjs from "dayjs";

import BarChart from "@/components/BarChart";
import { formatMoney } from "@/lib/format";
import { tokens } from "@/theme/tokens";

import type { MonthRow } from "./useDashboard";

const shortMoney = (v: number) =>
	v >= 1000
		? `${(v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k`
		: String(Math.round(v));

function TrendCard(props: {
	title: string;
	total: string;
	hint: string;
	bars: { label: string; value: number; note?: string }[];
	format: (v: number) => string;
	axisFormat?: (v: number) => string;
}) {
	return (
		<Card title={props.title} style={{ height: "100%" }}>
			<Typography.Title level={4} style={{ margin: 0, whiteSpace: "nowrap" }}>
				{props.total}
			</Typography.Title>
			<Typography.Text type="secondary">{props.hint}</Typography.Text>
			<div style={{ marginTop: tokens.space.xl }}>
				<BarChart
					title={props.title}
					bars={props.bars}
					format={props.format}
					axisFormat={props.axisFormat}
				/>
			</div>
		</Card>
	);
}

export default function TrendCharts({ months }: { months: MonthRow[] }) {
	const thisMonth = dayjs().format("YYYY-MM");
	const bars = (pick: (m: MonthRow) => number) =>
		months.map((m) => ({
			label: dayjs(`${m.month}-01`).format("MMM"),
			value: pick(m),
			note: m.month === thisMonth ? "this month, so far" : undefined,
		}));
	const showMoney = months.some((m) => m.received !== null);
	const sum = (pick: (m: MonthRow) => number) => months.reduce((s, m) => s + pick(m), 0);

	return (
		<Row gutter={[tokens.space.lg, tokens.space.lg]}>
			{showMoney && (
				<Col xs={24} lg={12}>
					<TrendCard
						title="Money received per month"
						total={formatMoney(sum((m) => m.received ?? 0))}
						hint="Paid by customers in the last 6 months, less refunds"
						bars={bars((m) => m.received ?? 0)}
						format={formatMoney}
						axisFormat={shortMoney}
					/>
				</Col>
			)}
			<Col xs={24} lg={showMoney ? 12 : 24}>
				<TrendCard
					title="New jobs per month"
					total={`${sum((m) => m.jobs).toLocaleString()} jobs`}
					hint="Jobs created in the last 6 months"
					bars={bars((m) => m.jobs)}
					format={(v) => v.toLocaleString()}
				/>
			</Col>
		</Row>
	);
}
