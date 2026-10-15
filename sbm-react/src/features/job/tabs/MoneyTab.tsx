// Money tab: all money figures of the job (as JMS Settings allows) and every
// invoice and payment made for it.

import { Card, Col, Flex, Row, Statistic } from "antd";

import { formatMoney } from "@/lib/format";
import { tokens } from "@/theme/tokens";

import type { Metric } from "../useJob";

import LinkedDocuments from "./LinkedDocuments";

export default function MoneyTab({ name, metrics }: { name: string; metrics: Metric[] }) {
	return (
		<Flex vertical gap={tokens.space.lg}>
			<Row gutter={[tokens.space.md, tokens.space.md]}>
				{metrics
					.filter((m) => m.visible)
					.map((m) => (
						<Col key={m.key} xs={12} md={8} xl={6} xxl={4}>
							<Card size="small" style={{ height: "100%" }}>
								<Statistic
									title={m.label}
									value={m.value}
									formatter={(v) => formatMoney(Number(v))}
									valueStyle={{
										fontSize: tokens.font.size.lg,
										color:
											m.key === "net_profit"
												? tokens.color.primary
												: undefined,
									}}
								/>
							</Card>
						</Col>
					))}
			</Row>
			<LinkedDocuments name={name} />
		</Flex>
	);
}
