// The tasks of one job in columns by status. Drag a card to another column to move
// the task there; moving to Pending asks for the reason.

import { Card, Flex, Input, Modal, Typography } from "antd";
import { useState } from "react";

import { formatDate } from "@/lib/format";
import { tokens } from "@/theme/tokens";

import { BOARD_STATUSES, useMoveTask, type BoardTask } from "./useTaskBoard";

const { color, space, radius, font } = tokens;
const DOT: Record<string, string> = {
	Open: color.textMuted,
	"In Progress": color.info,
	Pending: color.warning,
	Completed: color.success,
	Cancelled: color.danger,
};

function TaskTile({ task, onDragStart }: { task: BoardTask; onDragStart: () => void }) {
	const who =
		task.employee__outsource === "Outsource"
			? `${task.assigned_tos || "Outside party"} (outsource)`
			: task.employee_name || "Not assigned";
	return (
		<Card
			size="small"
			draggable
			onDragStart={onDragStart}
			className="sbm-lift"
			style={{ cursor: "grab" }}
		>
			<Typography.Text strong>{task.task_name}</Typography.Text>
			<Typography.Text type="secondary" style={{ display: "block", fontSize: font.size.sm }}>
				{who}
				{task.due_date ? ` · due ${formatDate(task.due_date)}` : ""}
			</Typography.Text>
			{task.status === "Pending" && task.pending_reason && (
				<Typography.Text
					style={{ display: "block", fontSize: font.size.sm, color: color.warning }}
				>
					{task.pending_reason}
				</Typography.Text>
			)}
		</Card>
	);
}

export default function Kanban({ tasks }: { tasks: BoardTask[] }) {
	const { move, moving } = useMoveTask();
	const [dragging, setDragging] = useState<BoardTask>();
	const [over, setOver] = useState<string>();
	const [asking, setAsking] = useState<BoardTask>();
	const [reason, setReason] = useState("");

	const drop = (status: string) => {
		setOver(undefined);
		const task = dragging;
		setDragging(undefined);
		if (!task || task.status === status) return;
		if (status === "Pending") {
			setReason("");
			setAsking(task);
		} else void move(task.name, status).catch(() => undefined);
	};

	return (
		<>
			<Flex gap={space.sm} style={{ overflowX: "auto", paddingBottom: space.sm }}>
				{BOARD_STATUSES.map((status) => {
					const list = tasks.filter((t) => t.status === status);
					const target = over === status && dragging?.status !== status;
					return (
						<div
							key={status}
							onDragOver={(e) => (e.preventDefault(), setOver(status))}
							onDragLeave={() => setOver(undefined)}
							onDrop={(e) => (e.preventDefault(), drop(status))}
							style={{
								flex: "1 0 150px",
								minHeight: 240,
								padding: space.sm,
								borderRadius: radius.lg,
								background: target ? color.primaryBg : color.bg,
								outline: target ? `2px dashed ${color.primary}` : "none",
								transition: "background 150ms",
							}}
						>
							<Flex
								justify="space-between"
								align="center"
								style={{ marginBottom: space.sm }}
							>
								<Typography.Text strong>
									<span
										style={{
											display: "inline-block",
											width: 8,
											height: 8,
											borderRadius: "50%",
											background: DOT[status],
											marginRight: space.xs,
										}}
									/>
									{status}
								</Typography.Text>
								<Typography.Text type="secondary">{list.length}</Typography.Text>
							</Flex>
							<Flex vertical gap={space.sm} style={{ opacity: moving ? 0.6 : 1 }}>
								{list.map((task) => (
									<TaskTile
										key={task.name}
										task={task}
										onDragStart={() => setDragging(task)}
									/>
								))}
							</Flex>
						</div>
					);
				})}
			</Flex>
			<Modal
				open={!!asking}
				title={`Why is "${asking?.task_name}" pending?`}
				okText="Move to Pending"
				okButtonProps={{ disabled: !reason.trim(), loading: moving }}
				onCancel={() => setAsking(undefined)}
				onOk={() =>
					asking &&
					move(asking.name, "Pending", reason.trim()).then(
						() => setAsking(undefined),
						() => undefined,
					)
				}
				destroyOnHidden
			>
				<Input.TextArea
					autoFocus
					rows={3}
					value={reason}
					onChange={(e) => setReason(e.target.value)}
					placeholder="e.g. Waiting for the customer's passport"
				/>
			</Modal>
		</>
	);
}
