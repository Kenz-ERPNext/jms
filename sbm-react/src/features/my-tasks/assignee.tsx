// Who a task is assigned to, as one line of text.

import { Typography } from "antd";

import type { MyTask } from "./useMyTasks";

export function assigneeText(task: MyTask): string {
	if (task.employee__outsource === "Outsource") {
		return `${task.outsource_supplier || "Outside party"} (outsource)`;
	}
	return task.employee_name || task.assigned_to || "Not assigned";
}

export default function Assignee({ task }: { task: MyTask }) {
	const assigned = task.assigned_to || task.outsource_supplier;
	return (
		<Typography.Text type={assigned ? undefined : "warning"}>
			{assigneeText(task)}
		</Typography.Text>
	);
}
