// Shows how the amount typed will be applied to the job's open invoices (oldest
// first) and what is left as an advance, before saving.

import { useQuery } from "@tanstack/react-query";
import { Form, Typography } from "antd";

import { formatMoney } from "@/lib/format";
import { tokens } from "@/theme/tokens";

import { FULL_ROW } from "./fields";

import { allocate, openInvoices } from "./api";

interface AllocationPreviewProps {
	job: string;
	type: "Sales Invoice" | "Purchase Invoice";
	/** Form field with the amount; default "amount". */
	field?: string;
}

export default function AllocationPreview({
	job,
	type,
	field = "amount",
}: AllocationPreviewProps) {
	const amount = Number(Form.useWatch(field)) || 0;
	const { data: invoices = [], isLoading } = useQuery({
		queryKey: ["open-invoices", job, type],
		queryFn: () => openInvoices(job, type),
	});
	if (isLoading) return null;
	if (!invoices.length) {
		return (
			<Typography.Text
				type="secondary"
				style={{ ...FULL_ROW, display: "block", marginBottom: tokens.space.md }}
			>
				No open {type.toLowerCase()} yet: the whole amount is kept as an advance.
			</Typography.Text>
		);
	}
	const { rows, leftOver } = allocate(amount, invoices);
	return (
		<div style={{ ...FULL_ROW, marginBottom: tokens.space.md }}>
			<Typography.Text type="secondary">
				Open:{" "}
				{invoices
					.map((i) => `${i.name} (${formatMoney(i.outstanding_amount)})`)
					.join(", ")}
			</Typography.Text>
			{amount > 0 && (
				<Typography.Text style={{ display: "block" }}>
					Applied:{" "}
					{rows
						.map((r) => `${r.invoice} ${formatMoney(r.allocated_amount)}`)
						.join(", ") || "nothing"}
					{leftOver > 0 && ` · kept as advance ${formatMoney(leftOver)}`}
				</Typography.Text>
			)}
		</div>
	);
}
