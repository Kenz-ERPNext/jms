// Connections of one job, like the ERPNext Connections tab: Billing (Sales Invoice,
// Purchase Invoice) and Payments (Payment Entry), newest first. A document belongs
// to the job by `job` OR `custom_job`: payments made by Create Expense / Create
// Purchase Invoice only have `job`, so the ERPNext tab (custom_job only) misses them.
// Desk roles can open a document in ERPNext.

import { useList, type BaseRecord } from "@refinedev/core";
import { Card, Space, Table, Tag, Typography } from "antd";

import { formatDate, formatMoney } from "@/lib/format";
import { deskPath } from "@/lib/links";
import { ADMIN_ROLES, hasAnyRole } from "@/lib/roles";

interface Row {
	key: string;
	doctype: string;
	name: string;
	date: string;
	party: string;
	kind: string;
	amount: number;
	outstanding?: number;
	status?: string;
}

function useDocs(doctype: string, name: string, fields: string[]) {
	const { query } = useList({
		resource: doctype,
		filters: [
			{
				operator: "or",
				value: [
					{ field: "job", operator: "eq", value: name },
					{ field: "custom_job", operator: "eq", value: name },
				],
			},
			{ field: "docstatus", operator: "ne", value: 2 },
		],
		sorters: [{ field: "posting_date", order: "desc" }],
		pagination: { mode: "off" },
		meta: { fields },
	});
	return { rows: (query.data?.data ?? []) as BaseRecord[], loading: query.isLoading };
}

export default function LinkedDocuments({ name }: { name: string }) {
	const common = ["name", "posting_date", "docstatus", "status"];
	const si = useDocs("Sales Invoice", name, [
		...common,
		"customer_name",
		"grand_total",
		"outstanding_amount",
	]);
	const pi = useDocs("Purchase Invoice", name, [
		...common,
		"supplier_name",
		"grand_total",
		"outstanding_amount",
	]);
	const pe = useDocs("Payment Entry", name, [
		...common,
		"party_name",
		"payment_type",
		"party_type",
		"paid_amount",
		"mode_of_payment",
	]);

	const rows: Row[] = [
		...si.rows.map((d) => ({
			doctype: "Sales Invoice",
			kind: "Sales invoice",
			party: d.customer_name,
			amount: d.grand_total,
			outstanding: d.outstanding_amount,
			d,
		})),
		...pi.rows.map((d) => ({
			doctype: "Purchase Invoice",
			kind: "Purchase invoice",
			party: d.supplier_name,
			amount: d.grand_total,
			outstanding: d.outstanding_amount,
			d,
		})),
		...pe.rows.map((d) => ({
			doctype: "Payment Entry",
			kind: `${d.payment_type === "Receive" ? "Received from" : "Paid to"} ${String(d.party_type).toLowerCase()}`,
			party: d.party_name,
			amount: d.paid_amount,
			outstanding: undefined,
			d,
		})),
	]
		.map(({ d, ...r }) => ({
			...r,
			key: `${r.doctype}:${d.name}`,
			name: String(d.name),
			date: d.posting_date,
			status: d.docstatus === 0 ? "Draft" : d.status,
		}))
		.sort((a, b) => String(b.date).localeCompare(String(a.date)));

	return (
		<Card
			size="small"
			title={`Connections (${rows.length})`}
			extra={
				<Space wrap size={4}>
					<Typography.Text type="secondary">Billing:</Typography.Text>
					<Tag>Sales Invoice {si.rows.length}</Tag>
					<Tag>Purchase Invoice {pi.rows.length}</Tag>
					<Typography.Text type="secondary">Payments:</Typography.Text>
					<Tag>Payment Entry {pe.rows.length}</Tag>
				</Space>
			}
		>
			<Table<Row>
				size="small"
				rowKey="key"
				pagination={false}
				dataSource={rows}
				loading={si.loading || pi.loading || pe.loading}
				scroll={{ x: "max-content" }}
				locale={{ emptyText: "No invoice or payment yet" }}
				columns={[
					{ title: "Date", dataIndex: "date", render: (v: string) => formatDate(v) },
					{ title: "Type", dataIndex: "kind" },
					{
						title: "Number",
						render: (_, r) =>
							hasAnyRole(ADMIN_ROLES) ? (
								<a
									href={deskPath(r.doctype, r.name)}
									target="_blank"
									rel="noreferrer"
								>
									{r.name}
								</a>
							) : (
								r.name
							),
					},
					{ title: "Party", dataIndex: "party" },
					{
						title: "Amount",
						dataIndex: "amount",
						align: "right",
						render: (v: number) => formatMoney(v),
					},
					{
						title: "Unpaid",
						dataIndex: "outstanding",
						align: "right",
						render: (v?: number) =>
							v === undefined ? (
								""
							) : v > 0 ? (
								<Typography.Text type="warning">{formatMoney(v)}</Typography.Text>
							) : (
								"—"
							),
					},
					{
						title: "Status",
						dataIndex: "status",
						render: (v?: string) => v && <Tag>{v}</Tag>,
					},
				]}
			/>
		</Card>
	);
}
