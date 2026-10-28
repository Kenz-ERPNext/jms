// Refine filters and sorters → Frappe list arguments (filters, or_filters, order_by).
// Frappe ANDs `filters` and ORs `or_filters`, so one "or" group is supported.

import type { CrudFilter, CrudOperators, CrudSort, LogicalFilter } from "@refinedev/core";

export type FrappeFilter = [string, string, unknown];

type Operator = Exclude<CrudOperators, "or" | "and">;

const like =
	(pattern: (v: unknown) => string, negate = false) =>
	(v: unknown) =>
		[negate ? "not like" : "like", pattern(v)] as [string, unknown];
const anywhere = (v: unknown) => `%${v}%`;
const starts = (v: unknown) => `${v}%`;
const ends = (v: unknown) => `%${v}`;

const OPERATORS: Partial<Record<Operator, (value: unknown) => [string, unknown]>> = {
	eq: (v) => ["=", v],
	ne: (v) => ["!=", v],
	lt: (v) => ["<", v],
	gt: (v) => [">", v],
	lte: (v) => ["<=", v],
	gte: (v) => [">=", v],
	in: (v) => ["in", v],
	nin: (v) => ["not in", v],
	between: (v) => ["between", v],
	// Frappe's like is case-insensitive, so the case-sensitive ("…s") forms map the same
	contains: like(anywhere),
	containss: like(anywhere),
	ncontains: like(anywhere, true),
	ncontainss: like(anywhere, true),
	startswith: like(starts),
	startswiths: like(starts),
	nstartswith: like(starts, true),
	nstartswiths: like(starts, true),
	endswith: like(ends),
	endswiths: like(ends),
	nendswith: like(ends, true),
	nendswiths: like(ends, true),
	null: () => ["is", "not set"],
	nnull: () => ["is", "set"],
};

export function toFrappeFilters(filters: CrudFilter[] = []): {
	filters: FrappeFilter[];
	orFilters: FrappeFilter[];
} {
	const and: FrappeFilter[] = [];
	const or: FrappeFilter[] = [];
	let orGroups = 0;

	for (const filter of filters) {
		if (filter.operator === "and") {
			and.push(...toFrappeFilters(filter.value).filters);
		} else if (filter.operator === "or") {
			if (++orGroups > 1) throw new Error("Only one OR group of filters is supported");
			for (const inner of filter.value) {
				if (!("field" in inner)) throw new Error("Nested OR filters are not supported");
				pushLogical(or, inner);
			}
		} else {
			// not "and" / "or", so a field filter
			pushLogical(and, filter as LogicalFilter);
		}
	}
	return { filters: and, orFilters: or };
}

function pushLogical(target: FrappeFilter[], filter: LogicalFilter) {
	const { field, operator, value } = filter;
	// A cleared filter input gives no value: leave it out (null / nnull need none).
	const noValue = value === undefined || value === "" || (Array.isArray(value) && !value.length);
	if (noValue && operator !== "null" && operator !== "nnull") return;

	const map = OPERATORS[operator];
	if (!map) throw new Error(`Filter operator "${operator}" is not supported`);
	const [frappeOperator, frappeValue] = map(value);
	target.push([field, frappeOperator, frappeValue]);
}

/** "field asc, other desc". Field names are checked so nothing else reaches SQL. */
export function toOrderBy(sorters: CrudSort[] = []): string | undefined {
	const parts = sorters
		.filter((s) => /^[A-Za-z0-9_]+$/.test(s.field))
		.map((s) => `${s.field} ${s.order === "desc" ? "desc" : "asc"}`);
	return parts.length ? parts.join(", ") : undefined;
}
