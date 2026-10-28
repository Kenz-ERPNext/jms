// Data of the Task Board, from the dashboard API (jms/api/dashboard.py, Admin only):
// counts per task status, job cards with their task counts, one job's tasks and
// history, and moving a task to another status.

import { useCustom, useCustomMutation } from "@refinedev/core";
import { useQueryClient } from "@tanstack/react-query";

export const BOARD_STATUSES = ["Open", "In Progress", "Pending", "Completed", "Cancelled"];
export const statusKey = (s: string) => s.toLowerCase().replace(/ /g, "_");

type Counts = Record<string, number> & { tasks: Record<string, number> };

export interface BoardJob {
	name: string;
	job_title?: string;
	customer_name?: string;
	status: string;
	priority?: string;
	expected_completion_date?: string;
	overdue_status?: string;
	task_total: number;
	[status: string]: unknown;
}

export interface BoardTask {
	name: string;
	idx: number;
	task_name: string;
	employee__outsource?: string;
	employee_name?: string;
	assigned_to?: string;
	assigned_tos?: string;
	status: string;
	pending_reason?: string;
	due_date?: string;
}

export interface BoardEvent {
	actor_name: string;
	when: string;
	kind: string;
	task?: string;
	field_label: string;
	old?: string;
	new?: string;
	reason?: string;
}

export function useBoardCounts() {
	const { query } = useCustom<Counts>({ url: "jms.api.job_status_counts", method: "get" });
	return query.data?.data;
}

export function useBoardJobs(
	status: string | undefined,
	search: string,
	page: number,
	size: number,
) {
	const { query } = useCustom<{ jobs: BoardJob[]; total: number }>({
		url: "jms.api.job_cards",
		method: "get",
		config: {
			query: {
				status,
				search: search || undefined,
				start: (page - 1) * size,
				page_length: size,
			},
		},
	});
	return { data: query.data?.data, isLoading: query.isLoading, error: query.error };
}

export function useJobTasks(job?: string) {
	const { query } = useCustom<{ job: BoardJob; tasks: BoardTask[]; history: BoardEvent[] }>({
		url: "jms.api.job_tasks",
		method: "get",
		config: { query: { job } },
		queryOptions: { enabled: !!job },
	});
	return { data: query.data?.data, isLoading: query.isLoading };
}

export function useMoveTask() {
	const { mutateAsync, mutation } = useCustomMutation();
	const queryClient = useQueryClient();
	const move = async (task: string, status: string, pending_reason?: string) => {
		await mutateAsync({
			url: "jms.api.update_task_status",
			method: "post",
			values: { task, status, pending_reason },
			successNotification: () => ({ type: "success", message: `Task moved to ${status}` }),
			errorNotification: (error) => ({
				type: "error",
				message: "Could not move the task",
				description: error?.message,
			}),
		});
		await queryClient.invalidateQueries();
	};
	return { move, moving: mutation.isPending };
}
