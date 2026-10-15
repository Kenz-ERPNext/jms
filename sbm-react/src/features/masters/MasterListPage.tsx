// One master list (Customers, Employees, Outsourced Parties, Users), picked by the
// last part of the path. Search, ten a page; a row opens the record in ERPNext and
// "New" starts one there (the forms stay ERPNext's own).

import { PlusOutlined } from "@ant-design/icons";
import { useList, type CrudFilter } from "@refinedev/core";
import { Button, Card, Input, Typography } from "antd";
import dayjs from "dayjs";
import { useState } from "react";
import { useLocation } from "react-router";

import DataTable from "@/components/DataTable";
import { deskPath } from "@/lib/links";
import { tokens } from "@/theme/tokens";

import { MASTERS, type MasterColumn } from "./masterConfig";

const PAGE_SIZE = 10;
type Rec = Record<string, unknown> & { name: string };

function cell(v: unknown, col: MasterColumn) {
	if (col.kind === "check") return v ? "Yes" : "No";
	if (col.kind === "datetime") return v ? dayjs(String(v)).format("DD MMM YYYY, HH:mm") : "";
	return v as string;
}

export default function MasterListPage() {
	const slug = useLocation().pathname.split("/").pop() ?? "";
	const config = MASTERS[slug];
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const filters: CrudFilter[] = [
		...(config?.filters ?? []),
		...(search
			? [
					{
						operator: "or" as const,
						value: config.search.map((field) => ({
							field,
							operator: "contains" as const,
							value: search,
						})),
					},
				]
			: []),
	];
	const { query } = useList<Rec>({
		resource: config?.doctype ?? "",
		filters,
		sorters: config?.sort ? [{ field: config.sort, order: "asc" }] : [],
		pagination: { currentPage: page, pageSize: PAGE_SIZE },
		meta: { fields: ["name", ...(config?.columns.map((c) => c.field) ?? [])] },
		queryOptions: { enabled: !!config },
	});
	if (!config) return <Typography.Text>Unknown list.</Typography.Text>;
	const newPath = `${deskPath(config.doctype, "").replace(/\/$/, "")}/new`;

	return (
		<Card
			title={config.title}
			extra={
				<Button type="primary" icon={<PlusOutlined />} href={newPath} target="_blank">
					New
				</Button>
			}
		>
			<Input.Search
				allowClear
				placeholder={`Search ${config.noun}`}
				style={{ maxWidth: 320, marginBottom: tokens.space.md }}
				onSearch={(v) => (setSearch(v.trim()), setPage(1))}
			/>
			<DataTable<Rec>
				noun={config.noun}
				loading={query.isLoading}
				dataSource={query.data?.data}
				onRow={(r) => ({
					onClick: () => window.open(deskPath(config.doctype, r.name), "_blank"),
					style: { cursor: "pointer" },
				})}
				pagination={{
					current: page,
					pageSize: PAGE_SIZE,
					total: query.data?.total ?? 0,
					hideOnSinglePage: false,
					onChange: setPage,
				}}
				columns={config.columns.map((c, i) => ({
					title: c.label,
					dataIndex: c.field,
					ellipsis: true,
					render: (v: unknown) =>
						i === 0 ? (
							<Typography.Text strong style={{ color: tokens.color.primary }}>
								{cell(v, c)}
							</Typography.Text>
						) : (
							cell(v, c)
						),
				}))}
			/>
		</Card>
	);
}
