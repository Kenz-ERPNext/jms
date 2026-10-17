// Search box and filters of the Jobs list. Every change goes to the URL.

import { ClearOutlined } from "@ant-design/icons";
import { Button, DatePicker, Flex, Input, Select } from "antd";
import dayjs from "dayjs";

import LinkSelect from "@/components/LinkSelect";
import { tokens } from "@/theme/tokens";

import type { useJobsList } from "./useJobsList";

const STATUSES = ["Created", "In Progress", "Completed", "Closed", "Cancelled"];
const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
// the Create buttons whose documents can be looked for (jms/api/job_payments.py)
const PAYMENTS = [
	{ value: "invoice", label: "Invoice" },
	{ value: "advance_receipt", label: "Advance Receipt" },
	{ value: "payment_return", label: "Payment Return" },
	{ value: "expense", label: "Expense" },
	{ value: "expense_return", label: "Expense Return" },
	{ value: "outsource_advance", label: "Outsource Advance Payment" },
];
const opts = (values: string[]) => values.map((v) => ({ value: v, label: v }));

type ListState = ReturnType<typeof useJobsList>;

export default function JobsFilters({ list }: { list: ListState }) {
	const { filters, update } = list;
	const set = (key: string) => (v?: string | null) => update({ [key]: v ?? undefined });
	const width = { width: 190 };

	return (
		<Flex wrap gap={tokens.space.sm}>
			<Input.Search
				key={list.search}
				defaultValue={list.search}
				placeholder="Job no, title, customer or mobile"
				allowClear
				onSearch={(q) => update({ q })}
				style={{ width: 300 }}
			/>
			<LinkSelect
				doctype="Customer"
				labelField="customer_name"
				placeholder="Customer"
				value={filters.customer}
				onChange={set("customer")}
				style={width}
			/>
			<LinkSelect
				doctype="Agent"
				placeholder="Agent"
				value={filters.agent}
				onChange={set("agent")}
				style={width}
			/>
			<LinkSelect
				doctype="Job Type"
				placeholder="Job type"
				value={filters.job_type}
				onChange={set("job_type")}
				style={width}
			/>
			<Select
				placeholder="Status"
				allowClear
				options={opts(STATUSES)}
				value={filters.status}
				onChange={set("status")}
				style={{ width: 150 }}
			/>
			<Select
				placeholder="Priority"
				allowClear
				options={opts(PRIORITIES)}
				value={filters.priority}
				onChange={set("priority")}
				style={{ width: 130 }}
			/>
			<Select
				placeholder="Payments"
				allowClear
				// each kind with how many jobs have it
				options={PAYMENTS.map((p) => ({
					value: p.value,
					label: `${p.label} (${list.data?.payment_counts?.[p.value] ?? 0})`,
				}))}
				value={filters.payment}
				onChange={set("payment")}
				popupMatchSelectWidth={false}
				style={{ width: 210 }}
			/>
			<DatePicker.RangePicker
				placeholder={["Start from", "Start to"]}
				value={[
					filters.from_date ? dayjs(filters.from_date) : null,
					filters.to_date ? dayjs(filters.to_date) : null,
				]}
				onChange={(range) =>
					update({
						from_date: range?.[0]?.format("YYYY-MM-DD"),
						to_date: range?.[1]?.format("YYYY-MM-DD"),
					})
				}
			/>
			{list.activeFilters > 0 && (
				<Button icon={<ClearOutlined />} onClick={list.clearFilters}>
					Clear filters
				</Button>
			)}
		</Flex>
	);
}
