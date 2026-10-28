// Job pipeline: open jobs per stage as bars (longest = most jobs), in the order a
// job moves through them, and all jobs per status as small chips. Click to open.

import { Card, Flex, Progress, Tag, Typography } from "antd";
import { useNavigate } from "react-router";

import { jobsPath } from "@/lib/links";
import { tokens } from "@/theme/tokens";

import { STAGE_TEXT } from "./dashboardText";
import type { StepCount } from "./useDashboard";

interface PipelineCardProps {
	stages: StepCount[];
	statuses: StepCount[];
}

export default function PipelineCard({ stages, statuses }: PipelineCardProps) {
	const navigate = useNavigate();
	const max = Math.max(1, ...stages.map((s) => s.count));

	return (
		<Card title="Job pipeline" style={{ height: "100%" }}>
			<Typography.Text type="secondary">
				Open jobs by stage. Click a stage to see its jobs.
			</Typography.Text>
			<Flex vertical gap={tokens.space.md} style={{ margin: `${tokens.space.lg}px 0` }}>
				{stages.map((stage, i) => {
					const { hint, color } = STAGE_TEXT[stage.label] ?? {
						hint: "",
						color: tokens.color.info,
					};
					return (
						<div
							key={stage.label}
							role="button"
							className="sbm-row"
							tabIndex={0}
							onClick={() => navigate(jobsPath(stage.label))}
							onKeyDown={(e) => e.key === "Enter" && navigate(jobsPath(stage.label))}
							style={{ cursor: "pointer" }}
						>
							<Flex justify="space-between" align="baseline">
								<Typography.Text strong>
									{i + 1}. {stage.label}
								</Typography.Text>
								<Typography.Text
									strong
									style={{ color, fontSize: tokens.font.size.lg }}
								>
									{stage.count.toLocaleString()}
								</Typography.Text>
							</Flex>
							<Progress
								percent={(stage.count / max) * 100}
								showInfo={false}
								strokeColor={color}
								size="small"
							/>
							<Typography.Text
								type="secondary"
								style={{ fontSize: tokens.font.size.sm }}
							>
								{hint}
							</Typography.Text>
						</div>
					);
				})}
			</Flex>
			<Typography.Text type="secondary">All jobs by status</Typography.Text>
			<Flex wrap gap={tokens.space.sm} style={{ marginTop: tokens.space.sm }}>
				{statuses.map((s) => (
					<Tag
						key={s.label}
						style={{
							cursor: "pointer",
							padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
						}}
						onClick={() =>
							navigate(`${jobsPath()}?status=${encodeURIComponent(s.label)}`)
						}
					>
						{s.label} <strong>{s.count.toLocaleString()}</strong>
					</Tag>
				))}
			</Flex>
		</Card>
	);
}
