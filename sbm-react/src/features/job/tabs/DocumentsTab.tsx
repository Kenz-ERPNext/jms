// Documents tab: the papers the job needs and whether they have come in.

import { CheckCircleFilled, ClockCircleOutlined, PaperClipOutlined } from "@ant-design/icons";
import { Table, Typography } from "antd";

import { formatDate } from "@/lib/format";
import { tokens } from "@/theme/tokens";

import type { JobDoc } from "../useJob";

type Doc = JobDoc["documents"][number];

export default function DocumentsTab({ documents }: { documents: Doc[] }) {
	const received = documents.filter((d) => d.is_received).length;
	return (
		<>
			<Typography.Text type="secondary">
				{received} of {documents.length} documents received.
			</Typography.Text>
			<Table<Doc>
				style={{ marginTop: tokens.space.md }}
				size="middle"
				rowKey="name"
				pagination={false}
				dataSource={documents}
				locale={{ emptyText: "No documents listed for this job" }}
				columns={[
					{ title: "Document", dataIndex: "document_type" },
					{
						title: "Received",
						dataIndex: "is_received",
						render: (v: number, d) =>
							v ? (
								<Typography.Text type="success">
									<CheckCircleFilled /> {formatDate(d.received_date) || "Yes"}
								</Typography.Text>
							) : (
								<Typography.Text type="warning">
									<ClockCircleOutlined /> Waiting
								</Typography.Text>
							),
					},
					{
						title: "File",
						dataIndex: "attachment",
						render: (url?: string) =>
							url && (
								<a href={url} target="_blank" rel="noreferrer">
									<PaperClipOutlined /> Open
								</a>
							),
					},
				]}
			/>
		</>
	);
}
