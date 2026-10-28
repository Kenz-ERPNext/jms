// Activity Log: who created, edited, submitted, cancelled or deleted an invoice,
// payment or journal entry, newest first and grouped by day (the Accounting Change
// Log that jms/accounting_log.py writes). Click a change to see what changed.

import type { CrudFilter } from "@refinedev/core";
import {
	Badge,
	Card,
	DatePicker,
	Empty,
	Flex,
	Input,
	Pagination,
	Select,
	Skeleton,
	Typography,
} from "antd";
import dayjs from "dayjs";
import { useState } from "react";

import LinkSelect from "@/components/LinkSelect";
import { useOpenJob } from "@/features/job-form/JobModalProvider";
import { tokens } from "@/theme/tokens";

import ActivityItem, { ACTION_LOOK, type LogRow } from "./ActivityItem";
import { PAGE_SIZE, useActivityLog, type LogFilters } from "./useActivityLog";

const { space, font } = tokens;
// people who log in to the app (not website users or Guest)
const APP_USERS: CrudFilter[] = [
	{ field: "user_type", operator: "eq", value: "System User" },
	{ field: "name", operator: "ne", value: "Guest" },
];
const DOCTYPES = ["Sales Invoice", "Purchase Invoice", "Payment Entry", "Journal Entry", "Job"];

/** "Today", "Yesterday" or "Mon, 13 Oct 2026". */
function dayLabel(d: string): string {
	const day = dayjs(d).startOf("day");
	const diff = dayjs().startOf("day").diff(day, "day");
	return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : day.format("ddd, DD MMM YYYY");
}

function byDay(rows: LogRow[]): [string, LogRow[]][] {
	const groups = new Map<string, LogRow[]>();
	for (const r of rows) {
		const key = dayLabel(r.creation);
		groups.set(key, [...(groups.get(key) ?? []), r]);
	}
	return [...groups];
}

export default function ActivityLogPage() {
	const openJob = useOpenJob();
	const [page, setPage] = useState(1);
	const [f, setF] = useState<LogFilters>({});
	const [openRow, setOpenRow] = useState<string>();
	const { rows, total, loading } = useActivityLog(f, page);
	// any filter change starts again at page 1
	const set = (patch: LogFilters) => (setF({ ...f, ...patch }), setPage(1));
	const select = { allowClear: true, style: { width: 190 } };

	return (
		<Card
			title="Activity Log"
			extra={
				<Flex align="center" gap={space.md}>
					<Typography.Text type="secondary">
						Every change to invoices, payments and accounts, as it happens.
					</Typography.Text>
					{/* new changes are fetched every few seconds */}
					<Badge status="processing" color={tokens.color.success} text="Live" />
				</Flex>
			}
		>
			{/* the same filters, in the same order, as the desk's Accounting Activity page */}
			<Flex wrap gap={space.sm} style={{ marginBottom: space.lg }}>
				<Select
					{...select}
					placeholder="Document Type"
					options={DOCTYPES.map((d) => ({ value: d, label: d }))}
					onChange={(v) => set({ doctype: v })}
				/>
				<Select
					{...select}
					placeholder="Action"
					options={Object.keys(ACTION_LOOK).map((a) => ({ value: a, label: a }))}
					onChange={(v) => set({ action: v })}
				/>
				<LinkSelect
					{...select}
					doctype="User"
					labelField="full_name"
					descriptionField="name"
					filters={APP_USERS}
					placeholder="Changed By"
					value={f.user}
					onChange={(v) => set({ user: (v as string) || undefined })}
				/>
				<DatePicker
					style={{ width: 190 }}
					placeholder="From Date"
					format="DD-MM-YYYY"
					onChange={(d) => set({ fromDate: d ? d.format("YYYY-MM-DD") : undefined })}
				/>
				<Input.Search
					allowClear
					placeholder="Document"
					style={{ width: 220 }}
					onSearch={(v) => set({ search: v.trim() || undefined })}
				/>
			</Flex>
			{loading ? (
				<Skeleton active paragraph={{ rows: 8 }} />
			) : rows.length ? (
				<div style={{ maxHeight: "calc(100vh - 340px)", overflowY: "auto" }}>
					{byDay(rows).map(([day, list]) => (
						<div key={day} style={{ marginBottom: space.md }}>
							<Typography.Text
								type="secondary"
								strong
								style={{ fontSize: font.size.sm, textTransform: "uppercase" }}
							>
								{day}
							</Typography.Text>
							<Flex vertical style={{ marginTop: space.xs }}>
								{list.map((row) => (
									<ActivityItem
										key={row.name}
										row={row}
										open={openRow === row.name}
										onToggle={() =>
											setOpenRow(openRow === row.name ? undefined : row.name)
										}
										onJob={openJob}
									/>
								))}
							</Flex>
						</div>
					))}
				</div>
			) : (
				<Empty description="No changes match" />
			)}
			{total > PAGE_SIZE && (
				<Pagination
					align="end"
					style={{ marginTop: space.md }}
					current={page}
					pageSize={PAGE_SIZE}
					total={total}
					showSizeChanger={false}
					showTotal={(t, [from, to]) => `${from}–${to} of ${t.toLocaleString()} changes`}
					onChange={(p) => (setPage(p), setOpenRow(undefined))}
				/>
			)}
		</Card>
	);
}
