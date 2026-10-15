import { describe, expect, it } from "vitest";

import { mergeRows, withNulls } from "./useJobForm";

describe("job form saving", () => {
	it("keeps fields of a row the modal does not show", () => {
		const loaded = [
			{ name: "r1", task_name: "A", purchase_invoice: "PI-1", due_date: "2026-01-01" },
		];
		const edited = [{ name: "r1", task_name: "A changed" }];
		expect(mergeRows(edited, loaded)).toEqual([
			{
				name: "r1",
				task_name: "A changed",
				purchase_invoice: "PI-1",
				due_date: "2026-01-01",
			},
		]);
	});

	it("sends a cleared field as null so the server clears it", () => {
		const loaded: { name: string; assigned_to?: string }[] = [
			{ name: "r1", assigned_to: "EMP-1" },
		];
		expect(mergeRows([{ name: "r1", assigned_to: undefined }], loaded)).toEqual([
			{ name: "r1", assigned_to: null },
		]);
		expect(withNulls({ job_source: undefined, job_title: "x" })).toEqual({
			job_source: null,
			job_title: "x",
		});
	});

	it("adds new rows and drops removed ones", () => {
		const loaded = [{ name: "r1" }, { name: "r2" }];
		expect(mergeRows([{ name: "r2" }, { task_name: "new" }], loaded)).toEqual([
			{ name: "r2" },
			{ task_name: "new" },
		]);
	});
});
