// Dashboard, by importance: the money at the top, then the jobs that need action
// now, with the job pipeline beside them, and the last six months as charts.

import { PlusOutlined } from "@ant-design/icons";
import { Alert, Button, Col, Flex, Row, Skeleton, Space, Typography } from "antd";

import { useOpenJob } from "@/features/job-form/JobModalProvider";
import { getBoot } from "@/lib/boot";
import { tokens } from "@/theme/tokens";

import ActionPanel from "./ActionPanel";
import KpiCards from "./KpiCards";
import PipelineCard from "./PipelineCard";
import TrendCharts from "./TrendCharts";
import { useDashboard } from "./useDashboard";

export default function DashboardPage() {
	const { data, isLoading, error } = useDashboard();
	const company = getBoot().company;
	const openJob = useOpenJob();

	return (
		<Space direction="vertical" size={tokens.space.lg} style={{ width: "100%" }}>
			<Flex justify="space-between" align="center" wrap gap={tokens.space.sm}>
				<div>
					<Typography.Title level={3} style={{ margin: 0 }}>
						Dashboard
					</Typography.Title>
					<Typography.Text type="secondary">
						Overview of all jobs{company ? ` at ${company}` : ""}
					</Typography.Text>
				</div>
				<Space>
					<Button type="primary" icon={<PlusOutlined />} onClick={() => openJob()}>
						New Job
					</Button>
				</Space>
			</Flex>

			{error && (
				<Alert
					type="error"
					showIcon
					message="Could not load the dashboard"
					description={error.message}
				/>
			)}
			{isLoading && <Skeleton active paragraph={{ rows: 10 }} />}

			{data?.setup_needed === "job_dimension" && (
				<Alert
					type="warning"
					showIcon
					message="Money totals need one setting in ERPNext"
					description={
						<>
							Add the <b>Job</b> accounting dimension: in ERPNext open{" "}
							<a
								href="/app/accounting-dimension/new"
								target="_blank"
								rel="noreferrer"
							>
								Accounting Dimension → New
							</a>
							, set Reference Document Type to <b>Job</b> and save. Until then the
							amounts below show 0.
						</>
					}
				/>
			)}
			{data && (
				<>
					<KpiCards money={data.money} />
					<Row gutter={[tokens.space.lg, tokens.space.lg]}>
						<Col xs={24} xl={16}>
							<ActionPanel data={data} />
						</Col>
						<Col xs={24} xl={8}>
							<PipelineCard stages={data.stages} statuses={data.lifecycle} />
						</Col>
					</Row>
					<TrendCharts months={data.monthly} />
				</>
			)}
		</Space>
	);
}
