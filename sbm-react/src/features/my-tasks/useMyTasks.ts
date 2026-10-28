// The logged-in user's tasks and changing the status of one (jms/api/tasks.py).

import { useCustom, useCustomMutation } from "@refinedev/core";
import { useQueryClient } from "@tanstack/react-query";

export interface MyTask {
	name: string;
	task_name: string;
	status: string;
	pending_reason?: string;
	due_date?: string;
	priority?: string;
	completion_date?: string;
	job: string;
	employee__outsource?: string;
	assigned_to?: string;
	employee_name?: string;
	outsource_supplier?: string;
	job_title?: string;
	customer_name?: string;
	overdue: boolean;
}

interface MyTasksResponse {
	/** "all" for office users (every task), "mine" for Task Staff. */
	scope: "all" | "mine";
	has_employee: boolean;
	tasks: MyTask[];
}

export function useMyTasks(assignedTo?: string) {
	const { query } = useCustom<MyTasksResponse>({
		url: "jms.api.tasks.my_tasks",
		method: "get",
		config: { query: { assigned_to: assignedTo } },
	});
	const { mutateAsync, mutation } = useCustomMutation();
	const queryClient = useQueryClient();

	const setStatus = async (task: string, status: string, pending_reason?: string) => {
		await mutateAsync({
			url: "jms.api.tasks.set_task_status",
			method: "post",
			values: { task, status, pending_reason },
			successNotification: () => ({ type: "success", message: `Task set to ${status}` }),
			errorNotification: (error) => ({
				type: "error",
				message: "Could not change the task",
				description: error?.message,
			}),
		});
		// this list, the jobs list and the dashboard all change
		await queryClient.invalidateQueries();
	};

	return {
		// Not result.data: Refine gives {} there until the call has returned.
		data: query.data?.data,
		isLoading: query.isLoading,
		error: query.error,
		refetch: query.refetch,
		setStatus,
		/** The task being saved, if any. */
		saving: mutation.isPending
			? (mutation.variables?.values as { task?: string } | undefined)
			: undefined,
	};
}
