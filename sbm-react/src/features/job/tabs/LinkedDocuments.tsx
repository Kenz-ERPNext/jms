// Connections of one job, like ERPNext's: invoices and payments, newest made first,
// with when each was last updated. A document belongs to the job by `job` OR
// `custom_job` (Create Expense / Purchase Invoice payments only have `job`, which the
// ERPNext tab misses). Desk roles can open one in ERPNext. Office users can Cancel
// one and Amend a cancelled one (docAmend.tsx), which waits on top until amended.

import { useList, type BaseRecord } from "@refinedev/core";
import { Card, Space, Table, Tag, Typography } from "antd";

// Cancel / Amend is off until the client confirms it; uncomment the lines marked AMEND
// import { useDocAmend } from "@/features/job-actions/docAmend"; // AMEND
import { canUseDesk } from "@/lib/boot";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { deskPath } from "@/lib/links";
// import { hasAnyRole, OFFICE_ROLES } from "@/lib/roles"; // AMEND

interface Row {
	key: string;
	doctype: string;
	name: string;
	date: string;
	created: string;
	updated: string;
	party: string;
	kind: string;
	amount: number;
	outstanding?: number;
	status?: string;
	docstatus: number;
	amended_from?: string;
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
		],
		sorters: [{ field: "creation", order: "desc" }],
		pagination: { mode: "off" },
		meta: { fields },
	});
	return { rows: (query.data?.data ?? []) as BaseRecord[], loading: query.isLoading };
}

export default function LinkedDocuments({ name }: { name: string }) {
	const common = [
		"name",
		"posting_date",
		"creation",
		"modified",
		"docstatus",
		"status",
		"amended_from",
	];
	// const { column, amendModal } = useDocAmend(name); // AMEND
	// const office = hasAnyRole(OFFICE_ROLES); // AMEND
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

	const all: Row[] = [
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
			created: String(d.creation),
			updated: String(d.modified),
			status: d.docstatus === 0 ? "Draft" : d.docstatus === 2 ? "Cancelled" : d.status,
			docstatus: Number(d.docstatus),
			amended_from: d.amended_from,
		}))
		// newest made first, as ERPNext's Connections: an amendment comes to the top
		.sort((a, b) => b.created.localeCompare(a.created));
	// a cancelled document is done with once amended; until then it waits on top
	const amended = new Set(all.map((r) => r.amended_from).filter(Boolean));
	const cancelled = all.filter((r) => r.docstatus === 2 && !amended.has(r.name));
	const rows = [...cancelled, ...all.filter((r) => r.docstatus !== 2)];
	const live = (list: BaseRecord[]) => list.filter((d) => d.docstatus !== 2).length;

	return (
		<Card
			size="small"
			title={`Connections (${all.length - all.filter((r) => r.docstatus === 2).length})`}
			extra={
				<Space wrap size={4}>
					{cancelled.length > 0 && (
						<Tag color="red" style={{ marginRight: 8 }}>
							{cancelled.length} to amend
						</Tag>
					)}
					<Typography.Text type="secondary">Billing:</Typography.Text>
					<Tag>Sales Invoice {live(si.rows)}</Tag>
					<Tag>Purchase Invoice {live(pi.rows)}</Tag>
					<Typography.Text type="secondary">Payments:</Typography.Text>
					<Tag>Payment Entry {live(pe.rows)}</Tag>
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
							canUseDesk() ? (
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
						render: (v?: string) =>
							v && <Tag color={v === "Cancelled" ? "red" : undefined}>{v}</Tag>,
					},
					{
						title: "Updated",
						dataIndex: "updated",
						render: (v: string) => formatDateTime(v),
					},
					// ...(office ? [column] : []), // AMEND
				]}
			/>
			{/* {amendModal} AMEND */}
		</Card>
	);
}
