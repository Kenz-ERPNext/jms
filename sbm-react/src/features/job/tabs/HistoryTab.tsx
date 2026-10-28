// History tab (Admin): who changed what on this job and when, newest first.
// Uses the existing dashboard API (jms.api.job_tasks), which reads Updated Document.

import { useCustom } from "@refinedev/core";
import { Empty, Skeleton, Timeline, Typography } from "antd";
import dayjs from "dayjs";

import { tokens } from "@/theme/tokens";

interface HistoryEvent {
	actor_name?: string;
	actor?: string;
	when: string;
	kind: string;
	field_label?: string;
	task?: string | null;
	old?: string | null;
	new?: string | null;
	reason?: string | null;
}

function describe(e: HistoryEvent): string {
	const what = e.task ? `${e.field_label} of "${e.task}"` : e.field_label;
	if (e.kind === "row_added") return `added ${e.field_label}${e.task ? ` "${e.task}"` : ""}`;
	if (e.kind === "row_removed") return `removed ${e.field_label}${e.task ? ` "${e.task}"` : ""}`;
	if (!e.old) return `set ${what} to ${e.new ?? "empty"}`;
	return `changed ${what} from ${e.old} to ${e.new || "empty"}`;
}

export default function HistoryTab({ name }: { name: string }) {
	const { query } = useCustom<{ history: HistoryEvent[] }>({
		url: "jms.api.job_tasks",
		method: "get",
		config: { query: { job: name } },
	});
	if (query.isLoading) return <Skeleton active />;
	const events = query.data?.data?.history ?? [];
	if (!events.length) return <Empty description="No changes recorded yet" />;

	return (
		<Timeline
			style={{ marginTop: tokens.space.md }}
			items={events.map((e) => ({
				children: (
					<>
						<Typography.Text strong>{e.actor_name || e.actor}</Typography.Text>{" "}
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
