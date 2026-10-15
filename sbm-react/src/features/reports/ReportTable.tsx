// A report's rows as a table: values formatted by column type (money, dates, numbers),
// a Job number opens the job, total rows in bold. A report with sections gets the
// sectioned view (summary cards, document tabs). CSV export of what is shown.

import { DownloadOutlined } from "@ant-design/icons";
import { Button, Flex, Typography, type TableColumnsType } from "antd";

import DataTable from "@/components/DataTable";
import { useOpenJob } from "@/features/job-form/JobModalProvider";
import { tokens } from "@/theme/tokens";

import { NUMBER, show, toCsv, toRows, usedColumns, type Row } from "./reportRows";
import SectionedReport from "./SectionedReport";
import { hasSections, toSections } from "./sections";
import type { ReportColumn, ReportRow } from "./useReport";

export default function ReportTable({
	name,
	columns,
	rows,
	loading,
}: {
	name: string;
	columns: ReportColumn[];
	rows: ReportRow[];
	loading: boolean;
}) {
	const openJob = useOpenJob();
	const data = toRows(rows, columns);

	const download = () => {
		const blob = new Blob([toCsv(data, columns)], { type: "text/csv" });
		const a = Object.assign(document.createElement("a"), {
			href: URL.createObjectURL(blob),
			download: `${name}.csv`,
		});
		a.click();
		URL.revokeObjectURL(a.href);
	};

	const shown = usedColumns(data, columns);
	const tableColumns: TableColumnsType<Row> = shown.map((c) => ({
		title: c.label,
		dataIndex: c.fieldname,
		align: NUMBER.includes(c.fieldtype ?? "") ? "right" : "left",
		width: c.width,
		ellipsis: true,
		render: (v: unknown, row) => {
			const text = show(v, c);
			if (c.fieldtype === "Link" && c.options === "Job" && v && !row._total) {
				return <a onClick={() => openJob(String(v))}>{text}</a>;
			}
			return row._total ? <strong>{text}</strong> : text;
		},
	}));

	const sectioned = !loading && hasSections(data);

	return (
		<>
			<Flex justify="space-between" align="center">
				<Typography.Text type="secondary">
					{loading
						? "Running…"
						: sectioned
							? ""
							: `${data.filter((r) => !r._total).length.toLocaleString()} rows`}
				</Typography.Text>
				<Button
					size="small"
					icon={<DownloadOutlined />}
					onClick={download}
					disabled={!data.length}
				>
					Export CSV
				</Button>
			</Flex>
			{sectioned ? (
				<div style={{ marginTop: tokens.space.md }}>
					<SectionedReport sections={toSections(data, columns)} columns={columns} />
				</div>
			) : (
				<DataTable<Row>
					style={{ marginTop: tokens.space.md }}
					rowKey="_key"
					size="small"
					loading={loading}
					columns={tableColumns}
					dataSource={data}
					rowsHeight="calc(100vh - 400px)"
					pagination={{ pageSize: 50 }}
					rowClassName={(r) => (r._total ? "sbm-total-row" : "")}
					locale={{ emptyText: "No rows for these filters" }}
				/>
			)}
		</>
	);
}
