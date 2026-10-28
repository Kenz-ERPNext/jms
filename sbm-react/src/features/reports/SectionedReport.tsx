// A report with sections (like Day Business Summary): each summary as a card of
// label = amount lines with its total at the bottom, and the document lists in tabs
// with their counts.

import { Badge, Card, Col, Empty, Flex, Row as Grid, Tabs, Typography } from "antd";

import DataTable from "@/components/DataTable";
import { formatMoney } from "@/lib/format";
import { tokens } from "@/theme/tokens";

import { NUMBER, show, usedColumns, type Row } from "./reportRows";
import type { Section } from "./sections";
import type { ReportColumn } from "./useReport";

const { color, space, font } = tokens;

function SummaryCard({ section, columns }: { section: Section; columns: ReportColumn[] }) {
	const label = columns.find((c) => !NUMBER.includes(c.fieldtype ?? ""));
	const amount = (r: Row) =>
		columns.find((c) => NUMBER.includes(c.fieldtype ?? "") && show(r[c.fieldname], c));
	const line = (r: Row) => {
		const col = amount(r);
		return {
			text: label ? show(r[label.fieldname], label) : "",
			value: col ? show(r[col.fieldname], col) : formatMoney(0),
		};
	};
	const lines = section.rows.filter((r) => !r._total);
	const totals = section.rows.filter((r) => r._total);

	return (
		<Card size="small" title={section.title} style={{ height: "100%" }}>
			<Flex vertical gap={space.xs}>
				{lines.map((r) => {
					const { text, value } = line(r);
					return (
						<Flex key={r._key} justify="space-between" gap={space.md}>
							<Typography.Text type="secondary">{text}</Typography.Text>
							<Typography.Text>{value}</Typography.Text>
						</Flex>
					);
				})}
				{totals.map((r) => {
					const { text, value } = line(r);
					return (
						<Flex
							key={r._key}
							justify="space-between"
							align="baseline"
							gap={space.md}
							style={{
								borderTop: `1px solid ${color.border}`,
								paddingTop: space.sm,
								marginTop: space.xs,
							}}
						>
							<Typography.Text strong>{text}</Typography.Text>
							<Typography.Text
								strong
								style={{ fontSize: font.size.lg, color: color.primary }}
							>
								{value}
							</Typography.Text>
						</Flex>
					);
				})}
			</Flex>
		</Card>
	);
}

function DetailsTable({ section, columns }: { section: Section; columns: ReportColumn[] }) {
	if (!section.rows.length) return <Empty description="Nothing here for this day" />;
	return (
		<DataTable<Row>
			rowKey="_key"
			size="small"
			dataSource={section.rows}
			rowsHeight="45vh"
			columns={usedColumns(section.rows, columns).map((c) => ({
				title: c.label,
				dataIndex: c.fieldname,
				align: NUMBER.includes(c.fieldtype ?? "") ? "right" : "left",
				ellipsis: true,
				render: (v: unknown) => show(v, c),
			}))}
		/>
	);
}

export default function SectionedReport({
	sections,
	columns,
}: {
	sections: Section[];
	columns: ReportColumn[];
}) {
	const summaries = sections.filter((s) => s.kind === "summary");
	const details = sections.filter((s) => s.kind === "details");
	return (
		<Flex vertical gap={space.lg}>
			{!!summaries.length && (
				<Grid gutter={[space.md, space.md]}>
					{summaries.map((s) => (
						<Col
							key={s.title}
							xs={24}
							md={12}
							// share the row: two summaries take half each, three or more a third
							xl={Math.max(8, 24 / summaries.length)}
						>
							<SummaryCard section={s} columns={columns} />
						</Col>
					))}
				</Grid>
			)}
			{!!details.length && (
				<Tabs
					items={details.map((s) => ({
						key: s.title,
						label: (
							<Flex align="center" gap={space.xs}>
								{s.title || "Details"}
								<Badge
									count={s.rows.length}
									showZero
									color={s.rows.length ? color.primary : color.border}
								/>
							</Flex>
						),
						children: <DetailsTable section={s} columns={columns} />,
					}))}
				/>
			)}
		</Flex>
	);
}
