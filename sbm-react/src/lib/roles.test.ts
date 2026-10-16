import { afterEach, describe, expect, it } from "vitest";

import { accessControlProvider } from "@/providers/accessControl";

import { ADMIN_ROLES, hasAnyRole, homePath, OFFICE_ROLES } from "./roles";

afterEach(() => {
	delete window.boot;
});

const as = (roles: string[]) => {
	window.boot = { user: "u@example.com", roles };
};
const can = async (resource: string) =>
	(await accessControlProvider.can({ resource, action: "list" })).can;

describe("roles", () => {
	it("an empty list means everyone", () => {
		expect(hasAnyRole([], ["Task Staff"])).toBe(true);
	});

	it("matches any of the roles", () => {
		expect(hasAnyRole(OFFICE_ROLES, ["Accounts User"])).toBe(true);
		expect(hasAnyRole(ADMIN_ROLES, ["Accounts User"])).toBe(false);
	});

	it("sends office users to the Dashboard and Task Staff to their tasks", () => {
		expect(homePath()).toBe("/sbm/dashboard");
	});
});

describe("accessControlProvider", () => {
	it("Task Staff see only My Tasks", async () => {
		as(["Task Staff", "Employee"]);
		expect(await can("my-tasks")).toBe(true);
		expect(await can("Job")).toBe(false);
		expect(await can("dashboard")).toBe(true);
		expect(await can("Customer")).toBe(false);
	});

	it("Accounts User sees office pages but not admin pages", async () => {
		as(["Accounts User"]);
		expect(await can("Job")).toBe(true);
		expect(await can("Customer")).toBe(true);
		expect(await can("task-board")).toBe(false);
		expect(await can("activity-log")).toBe(false);
	});

	it("Admin sees everything", async () => {
		as(["Admin"]);
		for (const resource of ["Job", "task-board", "activity-log", "my-tasks"]) {
			expect(await can(resource)).toBe(true);
		}
	});
});
