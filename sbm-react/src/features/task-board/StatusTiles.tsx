// Jobs by the status of their tasks, one tile each: how many jobs, what share of
// all jobs, and how many tasks. Used on the Task Board (to filter) and on the Jobs
// list (to open the board on a status).

import { Card, Col, Flex, Row, Typography } from "antd";

import { tokens } from "@/theme/tokens";

import { BOARD_STATUSES, statusKey, useBoardCounts } from "./useTaskBoard";

const { color, space, font } = tokens;
export const TINT: Record<string, string> = {
	Open: color.textMuted,
	"In Progress": color.info,
	Pending: color.warning,
	Completed: color.success,
	Cancelled: color.danger,
};

interface Props {
	/** The status shown as chosen (undefined = all jobs). */
	active?: string | null;
	onPick: (status?: string) => void;
}

export default function StatusTiles({ active, onPick }: Props) {
	const counts = useBoardCounts();
	const all = Number(counts?.all) || 0;

	const tile = (label: string, s: string | undefined, key: string) => {
		const n = Number(counts?.[key]) || 0;
		const chosen = active !== null && active === s;
		return (
			<Col key={label} xs={12} md={8} xl={4}>
				<Card
					size="small"
					hoverable
					className="sbm-lift"
					onClick={() => onPick(s)}
					style={{
						height: "100%",
						borderColor: chosen ? color.primary : undefined,
						background: chosen ? color.primaryBg : undefined,
					}}
				>
					<Flex justify="space-between" align="baseline">
						<Typography.Text type="secondary">{label}</Typography.Text>
						{s && all > 0 && (
							<Typography.Text type="secondary" style={{ fontSize: font.size.sm }}>
								{Math.round((n / all) * 100)}%
							</Typography.Text>
						)}
					</Flex>
					<Typography.Title
						level={3}
						style={{ margin: 0, color: s ? TINT[s] : color.text }}
					>
						{n.toLocaleString()}
					</Typography.Title>
					<Typography.Text type="secondary" style={{ fontSize: font.size.sm }}>
						jobs · {(Number(counts?.tasks?.[key]) || 0).toLocaleString()} tasks
					</Typography.Text>
				</Card>
			</Col>
		);
	};

	return (
		<Row gutter={[space.md, space.md]}>
			{tile("All jobs", undefined, "all")}
			{BOARD_STATUSES.map((s) => tile(s, s, statusKey(s)))}
		</Row>
	);
}
