// Where the job is: two steppers (lifecycle by status, work & money by stage) and
// the four money figures that matter most for one job.

import { Card, Col, Row, Statistic, Steps } from "antd";

import { formatMoney } from "@/lib/format";
import { tokens } from "@/theme/tokens";

import type { JobDoc, JobState } from "./useJob";

const LIFECYCLE = ["Created", "In Progress", "Completed", "Closed"];
const STAGES = [
	"Processing Work",
	"Invoice Pending",
	"Amount Pending",
	"Exp Pending",
	"Completed",
];
const STAGE_TITLE: Record<string, string> = {
	"Processing Work": "Work",
	"Invoice Pending": "Invoice",
	"Amount Pending": "Collect",
	"Exp Pending": "Pay supplier",
	Completed: "Settled",
};
const SHOWN = ["net_profit", "total_received", "outstanding", "total_job_amount"];

export default function JobProgress({ job, state }: { job: JobDoc; state?: JobState }) {
	const dead = ["Cancelled", "Canceled", "Rejected"].includes(job.status);
	const lifecycle = LIFECYCLE.indexOf(job.status);
	const stage = state ? STAGES.indexOf(state.stage) : -1;
	const metrics = (state?.financials.metrics ?? []).filter(
		(m) => m.visible && SHOWN.includes(m.key),
	);

	return (
		<Row gutter={[tokens.space.lg, tokens.space.lg]}>
			<Col xs={24} xl={14}>
				<Card size="small" style={{ height: "100%" }}>
					<Steps
						size="small"
						status={dead ? "error" : undefined}
						current={lifecycle < 0 ? (job.status === "Processing" ? 1 : 0) : lifecycle}
						items={LIFECYCLE.map((title) => ({ title }))}
					/>
					{!dead && job.status !== "Closed" && (
						<Steps
							size="small"
							type="navigation"
							style={{ marginTop: tokens.space.md }}
							current={Math.max(stage, 0)}
							items={STAGES.map((s) => ({ title: STAGE_TITLE[s] }))}
						/>
					)}
				</Card>
			</Col>
			<Col xs={24} xl={10}>
				<Card size="small" style={{ height: "100%" }}>
					<Row gutter={tokens.space.md}>
						{metrics.map((m) => (
							<Col key={m.key} xs={12} md={6} xl={12} xxl={6}>
								<Statistic
									title={m.label}
									value={m.value}
									formatter={(v) => formatMoney(Number(v))}
									valueStyle={{
										fontSize: tokens.font.size.lg,
										color:
											m.key === "net_profit"
												? tokens.color.primary
												: undefined,
									}}
								/>
							</Col>
						))}
					</Row>
				</Card>
			</Col>
		</Row>
	);
}
