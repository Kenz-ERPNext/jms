// Refine data provider for Frappe. A Refine resource name is the DocType ("Job",
// "Job Type"); a record's id is its Frappe `name`. Uses only standard Frappe APIs:
// /api/resource/... for documents and /api/method/... for custom calls.
//
// meta.fields: the fields to read in lists (default all: ["*"]).

import type { BaseRecord, DataProvider } from "@refinedev/core";

import { apiFetch, type HttpMethod } from "@/lib/frappe";

import { toFrappeFilters, toOrderBy, type FrappeFilter } from "./frappeFilters";

type Doc = BaseRecord & { name: string };

const docPath = (doctype: string, name?: string | number) =>
	`/api/resource/${encodeURIComponent(doctype)}` +
	(name === undefined ? "" : `/${encodeURIComponent(String(name))}`);

const withId = (doc: Doc) => ({ ...doc, id: doc.name });

/** Refine adds `id`; Frappe does not know it. */
const withoutId = (variables: unknown) => {
	const rest = { ...(variables as Record<string, unknown>) };
	delete rest.id;
	return rest;
};

async function count(doctype: string, filters: FrappeFilter[], orFilters: FrappeFilter[]) {
	const body = await apiFetch("/api/method/frappe.desk.reportview.get_count", {
		query: { doctype, filters, or_filters: orFilters.length ? orFilters : undefined },
	});
	return Number(body.message) || 0;
}

export const dataProvider: DataProvider = {
	getApiUrl: () => "/api",

	getList: async ({ resource, pagination, sorters, filters, meta }) => {
		const { filters: and, orFilters } = toFrappeFilters(filters);
		const paged = (pagination?.mode ?? "server") === "server";
		const pageSize = pagination?.pageSize ?? 10;
		const page = pagination?.currentPage ?? 1;

		const [list, total] = await Promise.all([
			apiFetch(docPath(resource), {
				query: {
					fields: meta?.fields ?? ["*"],
					filters: and,
					or_filters: orFilters.length ? orFilters : undefined,
					order_by: toOrderBy(sorters),
					limit_start: paged ? (page - 1) * pageSize : 0,
					// 0 = no limit in Frappe
					limit_page_length: paged ? pageSize : 0,
				},
			}),
			paged ? count(resource, and, orFilters) : undefined,
		]);
		const data = (list.data as Doc[]).map(withId);
		return { data: data as never[], total: total ?? data.length };
	},

	getOne: async ({ resource, id }) => {
		const body = await apiFetch(docPath(resource, id));
		return { data: withId(body.data as Doc) as never };
	},

	getMany: async ({ resource, ids, meta }) => {
		const body = await apiFetch(docPath(resource), {
			query: {
				fields: meta?.fields ?? ["*"],
				filters: [["name", "in", ids]],
				limit_page_length: 0,
			},
		});
		return { data: (body.data as Doc[]).map(withId) as never[] };
	},

	create: async ({ resource, variables }) => {
		const body = await apiFetch(docPath(resource), {
			method: "POST",
			body: withoutId(variables),
		});
		return { data: withId(body.data as Doc) as never };
	},

	update: async ({ resource, id, variables }) => {
		const body = await apiFetch(docPath(resource, id), {
			method: "PUT",
			body: withoutId(variables),
		});
		return { data: withId(body.data as Doc) as never };
	},

	deleteOne: async ({ resource, id }) => {
		await apiFetch(docPath(resource, id), { method: "DELETE" });
		return { data: { id } as never };
	},

	/** url: a Frappe method ("jms.api.jobs.list_jobs") or a full API path ("/api/..."). */
	custom: async ({ url, method, query, payload }) => {
		const path = url.startsWith("/") ? url : `/api/method/${url}`;
		const httpMethod = method.toUpperCase() as HttpMethod;
		if (!["GET", "POST", "PUT", "DELETE"].includes(httpMethod)) {
			throw new Error(`HTTP method ${method} is not supported`);
		}
		const body = await apiFetch(path, {
			method: httpMethod,
			query: query as Record<string, unknown> | undefined,
			body: httpMethod === "GET" ? undefined : (payload ?? {}),
		});
		return { data: (body.message ?? body.data) as never };
	},
};
