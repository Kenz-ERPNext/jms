import { describe, expect, it } from "vitest";

import { toFrappeFilters, toOrderBy } from "./frappeFilters";

describe("toFrappeFilters", () => {
	it("maps field filters to Frappe operators", () => {
		const { filters } = toFrappeFilters([
			{ field: "status", operator: "eq", value: "Completed" },
			{ field: "job_title", operator: "contains", value: "visa" },
			{ field: "name", operator: "startswith", value: "JOB-" },
			{ field: "net_amount", operator: "gte", value: 100 },
			{ field: "status", operator: "nin", value: ["Cancelled", "Closed"] },
			{ field: "linked_invoice", operator: "nnull", value: undefined },
		]);
		expect(filters).toEqual([
			["status", "=", "Completed"],
			["job_title", "like", "%visa%"],
			["name", "like", "JOB-%"],
			["net_amount", ">=", 100],
			["status", "not in", ["Cancelled", "Closed"]],
			["linked_invoice", "is", "set"],
		]);
	});

	it("leaves out cleared filters", () => {
		const { filters } = toFrappeFilters([
			{ field: "status", operator: "eq", value: undefined },
			{ field: "job_title", operator: "contains", value: "" },
			{ field: "status", operator: "in", value: [] },
		]);
		expect(filters).toEqual([]);
	});

	it("puts one or-group in or_filters and flattens and-groups", () => {
		const result = toFrappeFilters([
			{ field: "company", operator: "eq", value: "Oasis" },
			{
				operator: "or",
				value: [
					{ field: "name", operator: "contains", value: "abc" },
					{ field: "customer_name", operator: "contains", value: "abc" },
				],
			},
			{ operator: "and", value: [{ field: "priority", operator: "eq", value: "High" }] },
		]);
		expect(result.filters).toEqual([
			["company", "=", "Oasis"],
			["priority", "=", "High"],
		]);
		expect(result.orFilters).toEqual([
			["name", "like", "%abc%"],
			["customer_name", "like", "%abc%"],
		]);
	});

	it("rejects what Frappe cannot express", () => {
		const or = {
			operator: "or" as const,
			value: [{ field: "a", operator: "eq" as const, value: 1 }],
		};
		expect(() => toFrappeFilters([or, or])).toThrow("Only one OR group");
		expect(() => toFrappeFilters([{ field: "a", operator: "ina", value: [1] }])).toThrow(
			"not supported",
		);
	});
});

describe("toOrderBy", () => {
	it("joins sorters and drops unsafe field names", () => {
		expect(
			toOrderBy([
				{ field: "modified", order: "desc" },
				{ field: "name; drop table x", order: "asc" },
				{ field: "job_title", order: "asc" },
			]),
		).toBe("modified desc, job_title asc");
		expect(toOrderBy([])).toBeUndefined();
	});
});
