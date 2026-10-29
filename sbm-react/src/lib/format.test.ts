import dayjs from "dayjs";
import { describe, expect, it } from "vitest";

import { daysAgo, formatDate, formatDateTime, formatMoney } from "./format";
import { deskPath, jobPath, jobsPath } from "./links";

describe("format", () => {
	it("formats money in the given currency", () => {
		expect(formatMoney(1234.5, "SAR")).toMatch(/1,234\.5/);
		expect(formatMoney(1234.5, "SAR")).toMatch(/SAR/);
		expect(formatMoney(null, "SAR")).toMatch(/0/);
	});

	it("falls back for an unknown currency code", () => {
		expect(formatMoney(5, "XX")).toBe("XX 5.00");
	});

	it("formats dates and counts days late", () => {
		expect(formatDate("2026-05-09")).toBe("09 May 2026");
		expect(formatDate(undefined)).toBe("");
		expect(formatDateTime("2026-10-29 17:15:53.479991")).toBe("29 Oct 2026, 17:15");
		expect(formatDateTime(null)).toBe("");
		expect(daysAgo("2026-05-09", dayjs("2026-05-12"))).toBe(3);
	});
});

describe("links", () => {
	it("encodes job names and tabs", () => {
		expect(jobPath("JOB-6004/26")).toBe("/sbm/jobs/JOB-6004/26");
		expect(jobPath("JOB 1/a#b")).toBe("/sbm/jobs/JOB%201/a%23b");
		expect(deskPath("Sales Invoice", "SI-1/2")).toBe("/app/sales-invoice/SI-1%2F2");
		expect(jobsPath("Invoice Pending")).toBe("/sbm/jobs?tab=Invoice%20Pending");
		expect(jobsPath()).toBe("/sbm/jobs");
	});
});
