// Overview tab: who and what the job is for, its dates, the services and totals.

import { Card, Col, Descriptions, Flex, Row, Table, Typography } from "antd";

import { formatDate, formatMoney } from "@/lib/format";
import { tokens } from "@/theme/tokens";

import type { JobDoc, JobItem } from "../useJob";

const money = (v?: number) => formatMoney(v ?? 0);

export default function OverviewTab({ job }: { job: JobDoc }) {
	return (
		<Flex vertical gap={tokens.space.lg}>
			<Row gutter={[tokens.space.lg, tokens.space.lg]}>
				<Col xs={24} lg={12}>
					<Card size="small" title="Customer" style={{ height: "100%" }}>
						<Descriptions size="small" column={1}>
							<Descriptions.Item label="Customer">
								{job.customer_name || job.customer}
							</Descriptions.Item>
							<Descriptions.Item label="Mobile">
								{job.customer_mobile}
							</Descriptions.Item>
							<Descriptions.Item label="Agent">{job.agent}</Descriptions.Item>
							<Descriptions.Item label="Bill to">
								{job.receivable_from}
							</Descriptions.Item>
						</Descriptions>
					</Card>
				</Col>
				<Col xs={24} lg={12}>
					<Card size="small" title="Job" style={{ height: "100%" }}>
						<Descriptions size="small" column={{ xs: 1, md: 2 }}>
							<Descriptions.Item label="Type">{job.job_type}</Descriptions.Item>
							<Descriptions.Item label="Nature">{job.job_nature}</Descriptions.Item>
							<Descriptions.Item label="Source">{job.job_source}</Descriptions.Item>
							<Descriptions.Item label="Priority">{job.priority}</Descriptions.Item>
							<Descriptions.Item label="Started">
								{formatDate(job.start_date)}
							</Descriptions.Item>
							<Descriptions.Item label="Due">
								{formatDate(job.expected_completion_date)}
							</Descriptions.Item>
							<Descriptions.Item label="Finished">
								{formatDate(job.completion_date)}
							</Descriptions.Item>
							<Descriptions.Item label="Closed">
								{formatDate(job.closing_date)}
							</Descriptions.Item>
						</Descriptions>
					</Card>
				</Col>
			</Row>

			<Card size="small" title="Services">
				<Table<JobItem>
					size="small"
					rowKey="name"
					pagination={false}
					dataSource={job.items}
					scroll={{ x: "max-content" }}
					locale={{ emptyText: "No services on this job" }}
					columns={[
						{
							title: "Service",
							render: (_, r) => r.description || r.work_template || r.item_code,
						},
						{ title: "Qty", dataIndex: "job_qty", align: "right" },
						{ title: "Fee", dataIndex: "fee_price", align: "right", render: money },
						{ title: "Extra", dataIndex: "extra", align: "right", render: money },
						{
							title: "Surcharge",
							dataIndex: "surcharge",
							align: "right",
							render: money,
						},
						{ title: "VAT %", dataIndex: "vat", align: "right" },
						{
							title: "Total",
							dataIndex: "total",
							align: "right",
							render: (v) => <strong>{money(v)}</strong>,
						},
					]}
				/>
				<Flex
					vertical
					align="end"
					gap={tokens.space.xs}
					style={{ marginTop: tokens.space.md }}
				>
					<Typography.Text type="secondary">
						Before VAT: {money(job.gross_amount)}
					</Typography.Text>
					{!!job.discount && (
						<Typography.Text type="secondary">
							Discount: {money(job.discount)}
						</Typography.Text>
					)}
					<Typography.Text strong style={{ fontSize: tokens.font.size.lg }}>
						Total with VAT: {money(job.net_amount)}
					</Typography.Text>
				</Flex>
			</Card>

			{job.notes && (
				<Card size="small" title="Notes">
					<Typography.Paragraph style={{ whiteSpace: "pre-wrap", margin: 0 }}>
						{job.notes}
					</Typography.Paragraph>
				</Card>
			)}
		</Flex>
	);
}
