import { afterEach, describe, expect, it, vi } from "vitest";

import { syncServiceTasks, tasksForTemplate, type WorkTemplate } from "./serviceTasks";

const single: WorkTemplate = {
	name: "WT1",
	description: "Visa",
	task: "TASK-1",
	status: "Open",
	item_code: "I1",
};
const withSubs: WorkTemplate = {
	name: "WT2",
	description: "Iqama",
	has_sub_tasks: 1,
	task: "ignored",
	sub_tasks: [
		{ task_name: "Collect papers", due_days: 2, status: "Working" },
		{ task_name: "Submit", due_days: 5 },
	],
};

describe("tasksForTemplate (same as the ERPNext form)", () => {
	it("adds one task for a service with a single task", () => {
		expect(tasksForTemplate(single, "2026-10-14")).toEqual([
			expect.objectContaining({
				task_name: "Visa - TASK-1",
				due_date: "2026-10-14",
				status: "Open",
				work_template: "WT1",
				item_code: "I1",
			}),
		]);
	});

	it("adds every sub-task, due on start + due days; a template status becomes Open", () => {
		const tasks = tasksForTemplate(withSubs, "2026-10-14");
		expect(tasks.map((t) => [t.task_name, t.due_date, t.status])).toEqual([
			["Iqama - Collect papers", "2026-10-16", "Open"],
			["Iqama - Submit", "2026-10-19", "Open"],
		]);
	});

	it("adds nothing for a service without tasks", () => {
		expect(tasksForTemplate({ name: "WT3", description: "x" }, "2026-10-14")).toEqual([]);
	});
});

describe("syncServiceTasks", () => {
	afterEach(() => vi.unstubAllGlobals());

	const serve = () =>
		vi.stubGlobal(
			"fetch",
			vi.fn(async (url: URL) => {
				const name = decodeURIComponent(String(url).split("/").pop()!);
				const data = { WT1: single, WT2: withSubs }[name];
				return new Response(JSON.stringify({ data }), { status: 200 });
			}),
		);

	it("adds the tasks of new services and keeps hand-made tasks", async () => {
		serve();
		const tasks = await syncServiceTasks(
			[{ work_template: "WT1" }],
			[{ task_name: "Call customer" }],
			"2026-10-14",
		);
		expect(tasks.map((t) => t.task_name)).toEqual(["Call customer", "Visa - TASK-1"]);
	});

	it("removes the tasks of a removed service and never adds a task twice", async () => {
		serve();
		const before = [
			{ name: "row1", task_name: "Visa - TASK-1", work_template: "WT1" },
			{ name: "row2", task_name: "Iqama - Submit", work_template: "WT2" },
		];
		const tasks = await syncServiceTasks(
			[{ work_template: "WT1" }, { work_template: "WT1" }],
			before,
			"2026-10-14",
		);
		expect(tasks).toEqual([
			{ name: "row1", task_name: "Visa - TASK-1", work_template: "WT1" },
		]);
	});
});
