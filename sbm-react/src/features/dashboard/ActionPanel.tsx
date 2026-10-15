// "Needs action": three tiles (ready to invoice, waiting for payment, late) with
// count and amount. The chosen tile's jobs show in one table below it.

import { Card, Flex, Typography } from "antd";
import { useState } from "react";
import { Link } from "react-router";

import { formatMoney } from "@/lib/format";
import { jobsPath } from "@/lib/links";
import { tokens } from "@/theme/tokens";

import ActionTable from "./ActionTable";
import { ACTIONS, type ListKey } from "./dashboardText";
import type { Dashboard } from "./useDashboard";

export default function ActionPanel({ data }: { data: Dashboard }) {
	const [selected, setSelected] = useState<ListKey>("to_invoice");
	const action = ACTIONS.find((a) => a.key === selected)!;
	const list = data[selected];

	return (
		<Card
			title="Needs action"
			extra={
				list.total > list.rows.length && (
					<Link to={jobsPath(action.tab)}>View all {list.total.toLocaleString()}</Link>
				)
			}
			style={{ height: "100%" }}
		>
			<Flex gap={tokens.space.md} wrap style={{ marginBottom: tokens.space.lg }}>
				{ACTIONS.map((a) => {
					const active = a.key === selected;
					const { total, amount } = data[a.key];
					return (
						<Card
							key={a.key}
							size="small"
							hoverable
							className="sbm-lift"
							onClick={() => setSelected(a.key)}
							style={{
								flex: "1 1 180px",
								borderLeft: `4px solid ${a.color}`,
								background: active ? tokens.color.primaryBg : tokens.color.surface,
								borderColor: active ? tokens.color.primary : undefined,
							}}
						>
							<Typography.Text strong>{a.title}</Typography.Text>
							<Flex align="baseline" gap={tokens.space.sm}>
								<Typography.Title level={3} style={{ margin: 0, color: a.color }}>
									{total.toLocaleString()}
								</Typography.Title>
								<Typography.Text type="secondary">
									{amount != null ? formatMoney(amount) : "jobs"}
								</Typography.Text>
							</Flex>
							<Typography.Text
								type="secondary"
								style={{ fontSize: tokens.font.size.sm }}
							>
								{a.hint}
							</Typography.Text>
						</Card>
					);
				})}
			</Flex>
			<ActionTable listKey={selected} rows={list.rows} empty={action.empty} />
			{list.total > list.rows.length && (
				<Typography.Text
					type="secondary"
					style={{ display: "block", marginTop: tokens.space.md }}
				>
					Showing the {list.rows.length} {action.order} of {list.total.toLocaleString()}{" "}
					jobs. <Link to={jobsPath(action.tab)}>See all of them</Link>
				</Typography.Text>
			)}
		</Card>
	);
}
