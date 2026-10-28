// The status buttons of one task, shared by the card (phone) and the table: Start,
// Done, Pending (asks for the reason) and Reopen, as fit its status.

import {
	CheckOutlined,
	PauseCircleOutlined,
	PlayCircleOutlined,
	UndoOutlined,
} from "@ant-design/icons";
import { Button, Input, Modal, Space, Tooltip } from "antd";
import { useState, type ReactNode } from "react";

import { tokens } from "@/theme/tokens";

import type { MyTask } from "./useMyTasks";

export interface TaskButtonsProps {
	task: MyTask;
	saving: boolean;
	onStatus: (status: string, reason?: string) => Promise<void>;
	size?: "small" | "middle";
}

export default function TaskButtons({
	task,
	saving,
	onStatus,
	size = "middle",
}: TaskButtonsProps) {
	const [asking, setAsking] = useState(false);
	const [reason, setReason] = useState(task.pending_reason ?? "");
	const done = task.status === "Completed";

	// small (table): icon buttons in their own colour, the name on hover
	const compact = size === "small";
	const tint: Record<string, string> = {
		Start: tokens.color.info,
		Done: tokens.color.success,
		Pending: tokens.color.warning,
		Reopen: tokens.color.textMuted,
	};
	const button = (status: string, label: string, icon: ReactNode, primary = false) => {
		const onClick =
			status === "Pending"
				? () => setAsking(true)
				: () => onStatus(status).catch(() => undefined);
		return compact ? (
			<Tooltip key={label} title={label}>
				<Button
					size="small"
					type="text"
					aria-label={label}
					icon={icon}
					loading={saving}
					style={{ color: tint[label] }}
					onClick={onClick}
				/>
			</Tooltip>
		) : (
			<Button
				key={label}
				size={size}
				type={primary ? "primary" : "default"}
				icon={icon}
				loading={saving}
				onClick={onClick}
			>
				{label}
			</Button>
		);
	};

	return (
		<>
			<Space wrap={!compact} size={compact ? 2 : 8}>
				{task.status === "Open" && button("In Progress", "Start", <PlayCircleOutlined />)}
				{!done && button("Completed", "Done", <CheckOutlined />, true)}
				{!done &&
					task.status !== "Pending" &&
					button("Pending", "Pending", <PauseCircleOutlined />)}
				{(done || task.status === "Pending") &&
					button("In Progress", "Reopen", <UndoOutlined />)}
			</Space>
			<Modal
				open={asking}
				title="Why is this task pending?"
				okText="Set to Pending"
				okButtonProps={{ disabled: !reason.trim(), loading: saving }}
				onCancel={() => setAsking(false)}
				onOk={() =>
					onStatus("Pending", reason.trim()).then(
						() => setAsking(false),
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
