// What an edit changed, as a small table: the field (and the table row it is in),
// the value before (struck through) and after. Added / removed rows are one line.

import { Typography } from "antd";

import { tokens } from "@/theme/tokens";

import type { Change } from "./changes";

const { color, space, font, radius } = tokens;
const cell = { padding: `${space.xs}px ${space.sm}px`, borderTop: `1px solid ${color.border}` };
const head = {
	...cell,
	borderTop: "none",
	color: color.textMuted,
	fontWeight: 600,
	textAlign: "left" as const,
};

export default function ChangeTable({ changes }: { changes: Change[] }) {
	return (
		<div
			style={{
				marginTop: space.sm,
				border: `1px solid ${color.border}`,
				borderRadius: radius.md,
				overflow: "hidden",
				fontSize: font.size.sm,
			}}
		>
			<table
				style={{ width: "100%", borderCollapse: "collapse", background: color.surface }}
			>
				<thead style={{ background: color.primaryBgSoft }}>
					<tr>
						<th style={{ ...head, width: "34%" }}>Field</th>
						<th style={head}>Before</th>
						<th style={head}>After</th>
					</tr>
				</thead>
				<tbody>
					{changes.map((c, i) => (
						<tr key={i}>
							<td style={cell}>
								<Typography.Text strong style={{ fontSize: font.size.sm }}>
									{c.field}
								</Typography.Text>
								{c.where && (
									<Typography.Text
										type="secondary"
										style={{ display: "block", fontSize: font.size.sm }}
									>
										{c.where}
									</Typography.Text>
								)}
							</td>
							{c.note ? (
								<td style={cell} colSpan={2}>
									{c.note}
								</td>
							) : (
								<>
									<td style={{ ...cell, color: color.danger }}>
										{c.before ? (
											<s>{c.before}</s>
										) : (
											<Typography.Text type="secondary">
												empty
											</Typography.Text>
										)}
									</td>
									<td style={{ ...cell, color: color.success, fontWeight: 600 }}>
										{c.after ?? (
											<Typography.Text type="secondary">
												empty
											</Typography.Text>
										)}
									</td>
								</>
							)}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
