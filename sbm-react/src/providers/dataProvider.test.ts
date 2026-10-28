import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FrappeError } from "@/lib/frappe";

import { dataProvider as dp } from "./dataProvider";

const reply = (status: number, body: object) => ({
	ok: status < 400,
	status,
	statusText: "",
	json: async () => body,
});

let fetchMock: ReturnType<typeof vi.fn>;
const call = (i = 0) => {
	const [url, init] = fetchMock.mock.calls[i];
	return { url: new URL(String(url)), init };
};
const param = (url: URL, key: string) => JSON.parse(url.searchParams.get(key) ?? "null");

beforeEach(() => {
	window.csrf_token = "tok";
	fetchMock = vi.fn();
	vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
	vi.unstubAllGlobals();
	delete window.csrf_token;
});

describe("dataProvider", () => {
	it("getList pages, filters, sorts, counts and adds id", async () => {
		fetchMock
			.mockResolvedValueOnce(
				reply(200, { data: [{ name: "Visa", default_duration_days: 7 }] }),
			)
			.mockResolvedValueOnce(reply(200, { message: 41 }));

		const result = await dp.getList({
			resource: "Job Type",
			pagination: { currentPage: 3, pageSize: 20 },
			filters: [{ field: "name", operator: "contains", value: "vi" }],
			sorters: [{ field: "name", order: "asc" }],
			meta: { fields: ["name", "default_duration_days"] },
		});

		const list = call(0).url;
		expect(list.pathname).toBe("/api/resource/Job%20Type");
		expect(param(list, "fields")).toEqual(["name", "default_duration_days"]);
		expect(param(list, "filters")).toEqual([["name", "like", "%vi%"]]);
		expect(list.searchParams.get("order_by")).toBe("name asc");
		expect(list.searchParams.get("limit_start")).toBe("40");
		expect(list.searchParams.get("limit_page_length")).toBe("20");
		expect(call(1).url.pathname).toBe("/api/method/frappe.desk.reportview.get_count");
		expect(result).toEqual({
			data: [{ name: "Visa", default_duration_days: 7, id: "Visa" }],
			total: 41,
		});
	});

	it("getList without paging reads all rows and skips the count", async () => {
		fetchMock.mockResolvedValueOnce(reply(200, { data: [{ name: "A" }, { name: "B" }] }));
		const result = await dp.getList({ resource: "Agent", pagination: { mode: "off" } });
		expect(call().url.searchParams.get("limit_page_length")).toBe("0");
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(result.total).toBe(2);
	});

	it("getOne encodes names that contain a slash", async () => {
		fetchMock.mockResolvedValueOnce(reply(200, { data: { name: "JOB-6004/26" } }));
		const { data } = await dp.getOne({ resource: "Job", id: "JOB-6004/26" });
		expect(call().url.pathname).toBe("/api/resource/Job/JOB-6004%2F26");
		expect(data.id).toBe("JOB-6004/26");
	});

	it("update sends PUT with the CSRF token and without id", async () => {
		fetchMock.mockResolvedValueOnce(reply(200, { data: { name: "Visa", is_active: 0 } }));
		await dp.update({
			resource: "Job Type",
			id: "Visa",
			variables: { id: "Visa", is_active: 0 },
		});
		const { url, init } = call();
		expect(url.pathname).toBe("/api/resource/Job%20Type/Visa");
		expect(init.method).toBe("PUT");
		expect(init.headers["X-Frappe-CSRF-Token"]).toBe("tok");
		expect(JSON.parse(init.body)).toEqual({ is_active: 0 });
	});

	it("create posts and deleteOne deletes", async () => {
		fetchMock
			.mockResolvedValueOnce(reply(200, { data: { name: "New" } }))
			.mockResolvedValueOnce(reply(202, { data: "ok" }));
		expect(
			(await dp.create({ resource: "Job Source", variables: { source_name: "New" } })).data
				.id,
		).toBe("New");
		expect(call(0).init.method).toBe("POST");
		expect((await dp.deleteOne({ resource: "Job Source", id: "New" })).data.id).toBe("New");
		expect(call(1).init.method).toBe("DELETE");
	});

	it("custom calls a Frappe method and returns its message", async () => {
		fetchMock.mockResolvedValueOnce(reply(200, { message: { total: 3 } }));
		const { data } = await dp.custom!({
			url: "jms.api.jobs.list_jobs",
			method: "get",
			query: { tab: "Closed" },
		});
		expect(call().url.pathname).toBe("/api/method/jms.api.jobs.list_jobs");
		expect(call().url.searchParams.get("tab")).toBe("Closed");
		expect(data).toEqual({ total: 3 });
	});

	it("throws a Refine HttpError with the server message", async () => {
		const body = {
			_server_messages: JSON.stringify([
				JSON.stringify({ message: "Job Type x not found" }),
			]),
		};
		fetchMock.mockResolvedValueOnce(reply(404, body));
		const request = dp.getOne({ resource: "Job Type", id: "x" });
		await expect(request).rejects.toBeInstanceOf(FrappeError);
		await expect(request).rejects.toMatchObject({
			statusCode: 404,
			message: "Job Type x not found",
		});
	});
});
