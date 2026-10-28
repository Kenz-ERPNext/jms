// The Job's money, as the ERPNext Job form's Financial tab shows it: the same
// Job.get_financials (GL by the Job dimension, payments, invoices), only the figures
// JMS Settings allow, in one summary card like the form's, with the Amount / Exp.
// Pending flags at the bottom.

import { useQuery } from "@tanstack/react-query";
import { Alert, Flex, Skeleton, Tag, Typography } from "antd";

import { runJobMethod } from "@/features/job-actions/api";
import { formatMoney } from "@/lib/format";
import { tokens } from "@/theme/tokens";

const { color, space, font, radius } = tokens;

interface Financials {
	currency?: string;
	metrics: { key: string; label: string; value: number; visible: boolean }[];
	received_from?: string;
	received_from_customer?: number;
	received_from_agent?: number;
	indicators?: { show?: boolean; amount_pending?: boolean; exp_pending?: boolean };
}

// the ERPNext form's names for the figures
const LABELS: Record<string, string> = {
	total_job_amount: "Total Job Amount",
	total_received: "Total Amount Received",
	outstanding: "Outstanding to Receive",
	total_expenses: "Total Expenses",
	outsourcing_cost: "Outsourcing Costs",
	paid_out: "Paid Out (Supplier/Agent)",
	expense_returns: "Expense Returns",
	payment_returns: "Payment Returns",
	net_profit: "Net Profit",
	profit_balance: "Profit Balance",
};

export default function FinancesTab({ name }: { name: string }) {
	const { data, isLoading, error } = useQuery({
		queryKey: ["job-financials", name],
		queryFn: () => runJobMethod<Financials>(name, "get_financials"),
	});
	if (isLoading) return <Skeleton active paragraph={{ rows: 6 }} />;
	if (error) {
		return (
			<Alert
				type="error"
				showIcon
				message="Could not load the figures"
				description={error.message}
			/>
		);
	}
	if (!data) return null;

	const money = (v?: number) => formatMoney(v ?? 0, data.currency);
	const shown = data.metrics.filter((m) => m.visible);
	const ind = data.indicators ?? {};
	const flags = ind.show && (ind.amount_pending || ind.exp_pending);
	const row = { padding: `${space.sm}px ${space.lg}px`, borderTop: `1px solid ${color.border}` };

	return (
		<div
			style={{
				maxWidth: 560,
				border: `1px solid ${color.border}`,
				borderLeft: `4px solid ${color.accent}`,
				borderRadius: radius.md,
				overflow: "hidden",
				background: color.surface,
			}}
		>
			<div
				style={{
					padding: `${space.sm + 2}px ${space.lg}px`,
					background: color.primary,
					color: color.surface,
					fontWeight: 600,
				}}
			>
				Job Financial Summary
			</div>
			{shown.map((m) => {
				const profit = m.key === "net_profit";
				return (
					<Flex key={m.key} justify="space-between" align="center" style={row}>
						<Typography.Text type="secondary" style={{ fontSize: font.size.sm }}>
							{LABELS[m.key] ?? m.label}
						</Typography.Text>
						<Typography.Text
							strong={profit}
							style={{
								color:
									m.value < 0
										? color.danger
										: profit
											? color.primary
											: color.text,
							}}
						>
							{money(m.value)}
						</Typography.Text>
					</Flex>
				);
			})}
			{/* who paid: the customer, the agent, or both */}
			{((data.received_from_agent ?? 0) > 0 || data.received_from === "Agent") && (
				<div style={{ ...row, background: color.primaryBgSoft, fontSize: font.size.sm }}>
					Received from <b>{data.received_from || "—"}</b> · Customer{" "}
					{money(data.received_from_customer)} · Agent {money(data.received_from_agent)}
				</div>
			)}
			{flags && (
				<Flex gap={space.sm} style={{ ...row, background: color.primaryBgSoft }}>
					{ind.amount_pending && <Tag color="error">Amount Pending</Tag>}
					{ind.exp_pending && <Tag color="warning">Exp. Pending</Tag>}
				</Flex>
			)}
		</div>
	);
}
