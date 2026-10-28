// Read-only checks of the data provider against a real site. Skipped unless
// SBM_LIVE_URL and SBM_LIVE_SID (a logged-in session id) are set, e.g.:
//   SBM_LIVE_URL=http://oasis:8000 SBM_LIVE_SID=<sid> yarn test
// Never writes data.

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { dataProvider as dp } from "./dataProvider";

const URL_ = process.env.SBM_LIVE_URL;
const SID = process.env.SBM_LIVE_SID;

describe.skipIf(!URL_ || !SID)("dataProvider against a live site", () => {
	beforeAll(() => {
		const realFetch = globalThis.fetch;
		vi.stubGlobal("location", { ...window.location, origin: URL_ });
		vi.stubGlobal("fetch", (url: URL, init: RequestInit = {}) =>
			realFetch(url, { ...init, headers: { ...init.headers, Cookie: `sid=${SID}` } }),
		);
	});
	afterAll(() => vi.unstubAllGlobals());

	it("lists a page with a total", async () => {
		const { data, total } = await dp.getList({
			resource: "Job Type",
			pagination: { currentPage: 1, pageSize: 5 },
			sorters: [{ field: "name", order: "asc" }],
			meta: { fields: ["name", "default_duration_days"] },
		});
		expect(data.length).toBeLessThanOrEqual(5);
		expect(total).toBeGreaterThanOrEqual(data.length);
		expect(data[0].id).toBe(data[0].name);
	});

	it("filters the same way in the list and the count", async () => {
		const filters = [
			{
				operator: "or" as const,
				value: [
					{ field: "name", operator: "eq" as const, value: "Insurance" },
					{ field: "name", operator: "startswith" as const, value: "Visa" },
				],
			},
		];
		const all = await dp.getList({
			resource: "Job Type",
			filters,
			pagination: { mode: "off" },
		});
		const paged = await dp.getList({
			resource: "Job Type",
			filters,
			pagination: { pageSize: 2 },
		});
		expect(paged.total).toBe(all.data.length);
	});

	it("reads one document whose name has a slash, and many by id", async () => {
		const { data } = await dp.getList({
			resource: "Job",
			filters: [{ field: "name", operator: "contains", value: "/" }],
			pagination: { pageSize: 2 },
			meta: { fields: ["name"] },
		});
		if (!data.length) return;
		const one = await dp.getOne({ resource: "Job", id: data[0].id! });
		expect(one.data.name).toBe(data[0].name);
		expect(Array.isArray(one.data.tasks)).toBe(true);
		const many = await dp.getMany!({
			resource: "Job",
			ids: data.map((d) => d.id!),
			meta: { fields: ["name"] },
		});
		expect(many.data.map((d) => d.id).sort()).toEqual(data.map((d) => d.id).sort());
	});

	it("returns a 404 error for a missing document", async () => {
		await expect(dp.getOne({ resource: "Job Type", id: "__missing__" })).rejects.toMatchObject(
			{
				statusCode: 404,
			},
		);
	});

	it("calls a custom method", async () => {
		const { data } = await dp.custom!({
			url: "jms.api.jobs.list_jobs",
			method: "get",
			query: { page_length: 1 },
		});
		expect(data).toHaveProperty("tab_counts");
	});
});
