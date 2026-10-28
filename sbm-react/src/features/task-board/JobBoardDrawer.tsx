// One job on the board: its tasks as a kanban, and the history beside it.

import { Col, Drawer, Row, Skeleton, Space, Typography } from "antd";

import StatusPill from "@/components/StatusPill";
import { tokens } from "@/theme/tokens";

import History from "./History";
import Kanban from "./Kanban";
import { useJobTasks } from "./useTaskBoard";

export default function JobBoardDrawer({ job, onClose }: { job?: string; onClose: () => void }) {
	const { data, isLoading } = useJobTasks(job);
	return (
		<Drawer
			open={!!job}
			onClose={onClose}
			width="min(1280px, 96vw)"
			destroyOnHidden
			title={
				data && (
					<Space wrap>
						<span>{data.job.name}</span>
						<StatusPill value={data.job.status} />
						<Typography.Text type="secondary" style={{ fontWeight: "normal" }}>
							{data.job.job_title} · {data.job.customer_name}
						</Typography.Text>
					</Space>
				)
			}
		>
			{isLoading || !data ? (
				<Skeleton active paragraph={{ rows: 8 }} />
			) : (
				<Row gutter={[tokens.space.xl, tokens.space.xl]}>
					<Col xs={24} xl={17}>
						<Typography.Paragraph type="secondary">
							Drag a task to another column to change its status.
						</Typography.Paragraph>
						<Kanban tasks={data.tasks} />
					</Col>
					<Col xs={24} xl={7}>
						<Typography.Title level={5}>History</Typography.Title>
						<History events={data.history} />
					</Col>
				</Row>
			)}
		</Drawer>
	);
}
