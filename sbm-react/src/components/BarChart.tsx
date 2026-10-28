// A small column chart for one series (e.g. a value per month). Thin bars with
// rounded tops on a shared baseline, faint grid lines, the top value on the axis,
// and a tooltip with the exact value on every bar. No chart library needed.

import { Flex, Tooltip, Typography } from "antd";

import { tokens } from "@/theme/tokens";

export interface Bar {
	label: string;
	value: number;
	/** Shown in the tooltip under the value, e.g. "so far". */
	note?: string;
}

interface BarChartProps {
	bars: Bar[];
	format: (value: number) => string;
	/** Shorter format for the axis label (default: format). */
	axisFormat?: (value: number) => string;
	height?: number;
	/** Read out for screen readers, e.g. "Money received per month". */
	title: string;
}

const GRID_LINES = 3;

export default function BarChart({
	bars,
	format,
	axisFormat = format,
	height = 160,
	title,
}: BarChartProps) {
	const max = Math.max(...bars.map((b) => b.value), 0) || 1;
	const { color, space, radius, font } = tokens;

	return (
		<div
			role="img"
			aria-label={`${title}: ${bars.map((b) => `${b.label} ${format(b.value)}`).join(", ")}`}
		>
			<div style={{ position: "relative", height }}>
				{Array.from({ length: GRID_LINES + 1 }, (_, i) => (
					<div
						key={i}
						style={{
							position: "absolute",
							left: 0,
							right: 0,
							bottom: `${(i / GRID_LINES) * 100}%`,
							borderTop: `1px solid ${i === 0 ? color.border : color.grid}`,
						}}
					/>
				))}
				<Typography.Text
					type="secondary"
					style={{
						position: "absolute",
						top: -space.lg,
						left: 0,
						fontSize: font.size.sm,
					}}
				>
					{axisFormat(max)}
				</Typography.Text>
				<Flex align="end" gap={space.sm} style={{ position: "absolute", inset: 0 }}>
					{bars.map((bar) => (
						<Tooltip
							key={bar.label}
							title={
								<>
									<strong>{bar.label}</strong>: {format(bar.value)}
									{bar.note && <div>{bar.note}</div>}
								</>
							}
						>
							{/* full-height hit area, so thin or empty bars are easy to hover */}
							<Flex
								align="end"
								justify="center"
								className="sbm-bar-hit"
								style={{ flex: 1, height: "100%", cursor: "default" }}
							>
								<div
									className="sbm-bar"
									style={{
										width: "60%",
										maxWidth: 40,
										height: `${(Math.max(bar.value, 0) / max) * 100}%`,
										minHeight: bar.value > 0 ? 2 : 0,
										background: color.chart,
										borderRadius: `${radius.sm - 2}px ${radius.sm - 2}px 0 0`,
									}}
								/>
							</Flex>
						</Tooltip>
					))}
				</Flex>
			</div>
			<Flex gap={space.sm} style={{ marginTop: space.xs }}>
				{bars.map((bar) => (
					<Typography.Text
						key={bar.label}
						type="secondary"
						style={{ flex: 1, textAlign: "center", fontSize: font.size.sm }}
					>
						{bar.label}
					</Typography.Text>
				))}
			</Flex>
		</div>
	);
}
