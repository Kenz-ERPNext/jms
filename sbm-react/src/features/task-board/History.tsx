// Who changed what on the job, newest first (Updated Document rows, made readable
// by the server).

import { Empty, Timeline, Typography } from "antd";
import dayjs from "dayjs";

import { tokens } from "@/theme/tokens";

import type { BoardEvent } from "./useTaskBoard";

function describe(e: BoardEvent): string {
	const what = e.task ? `${e.field_label} of "${e.task}"` : e.field_label;
	if (e.kind === "row_added")
		return `added ${e.field_label.toLowerCase()}${e.task ? ` "${e.task}"` : ""}`;
	if (e.kind === "row_removed")
		return `removed ${e.field_label.toLowerCase()}${e.task ? ` "${e.task}"` : ""}`;
	if (!e.old) return `set ${what} to ${e.new}`;
	return `changed ${what} from ${e.old} to ${e.new || "empty"}`;
}

export default function History({ events }: { events: BoardEvent[] }) {
	if (!events.length) return <Empty description="No changes recorded yet" />;
	return (
		<Timeline
			items={events.map((e, i) => ({
				key: i,
				color: e.kind === "status" ? tokens.color.primary : tokens.color.border,
				children: (
					<>
						<Typography.Text strong>{e.actor_name}</Typography.Text>{" "}
						<Typography.Text>{describe(e)}</Typography.Text>
						{e.reason && (
							<Typography.Text type="secondary" style={{ display: "block" }}>
								Reason: {e.reason}
							</Typography.Text>
						)}
						<Typography.Text
							type="secondary"
							style={{ display: "block", fontSize: tokens.font.size.sm }}
						>
							{dayjs(e.when).format("DD MMM YYYY, HH:mm")}
						</Typography.Text>
					</>
				),
			}))}
		/>
	);
}
