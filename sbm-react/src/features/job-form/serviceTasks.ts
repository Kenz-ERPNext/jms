// Tasks that come with the services, the same way the ERPNext Job form does it
// (sync_subtasks_for_items in job.js):
// - a service (Work Template) with sub-tasks adds "<service> - <sub-task>" for each,
//   due on start date + its due days;
// - otherwise a service with a single task adds "<service> - <task>";
// - tasks of a service that is no longer on the job are removed, tasks added by
//   hand stay, and a task name is never added twice.

import dayjs from "dayjs";

import { apiFetch } from "@/lib/frappe";

import { TASK_STATUSES, type ServiceRow, type TaskRow } from "./types";

export interface WorkTemplate {
	name: string;
	description?: string;
	item_code?: string;
	job_qty?: number;
	fee_price?: number;
	extra?: number;
	surcharge?: number;
	vat?: number;
	has_sub_tasks?: number;
	task?: string;
	status?: string;
	linked_task?: string;
	sub_tasks?: { task_name?: string; due_days?: number; status?: string; linked_task?: string }[];
}

const cache = new Map<string, Promise<WorkTemplate>>();

/** A Work Template with its sub-tasks, read once per page load. */
export function getTemplate(name: string): Promise<WorkTemplate> {
	if (!cache.has(name)) {
		const request = apiFetch(`/api/resource/Work Template/${encodeURIComponent(name)}`).then(
			(body) => body.data as WorkTemplate,
		);
		request.catch(() => cache.delete(name));
		cache.set(name, request);
	}
	return cache.get(name)!;
}

/** Template statuses (Working, Pending Review, ...) are not task statuses: use Open. */
const taskStatus = (status?: string) =>
	status && TASK_STATUSES.includes(status) ? status : "Open";

export function tasksForTemplate(t: WorkTemplate, start: string): TaskRow[] {
	const base = {
		work_template: t.name,
		item_code: t.item_code,
		employee__outsource: "Employee" as const,
	};
	if (t.has_sub_tasks && t.sub_tasks?.length) {
		return t.sub_tasks.map((sub) => ({
			...base,
			task_name: `${t.description} - ${sub.task_name}`,
			due_date: dayjs(start)
				.add(sub.due_days || 0, "day")
				.format("YYYY-MM-DD"),
			status: taskStatus(sub.status),
			linked_task: sub.linked_task,
		}));
	}
	if (t.task) {
		return [
			{
				...base,
				task_name: `${t.description} - ${t.task}`,
				due_date: start,
				status: taskStatus(t.status),
				linked_task: t.linked_task,
			},
		];
	}
	return [];
}

/** The task list after the services changed. */
export async function syncServiceTasks(
	items: ServiceRow[],
	tasks: TaskRow[],
	start = dayjs().format("YYYY-MM-DD"),
): Promise<TaskRow[]> {
	const active = [...new Set(items.map((i) => i?.work_template).filter(Boolean))] as string[];
	const kept = tasks.filter((t) => !t?.work_template || active.includes(t.work_template));
	const names = new Set(kept.map((t) => t.task_name));
	const templates = await Promise.all(active.map(getTemplate));
	const added = templates
		.flatMap((t) => tasksForTemplate(t, start))
		.filter((t) => !names.has(t.task_name) && (names.add(t.task_name), true));
	return [...kept, ...added];
}
