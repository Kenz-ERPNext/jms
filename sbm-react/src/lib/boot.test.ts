import { afterEach, describe, expect, it, vi } from "vitest";

import { getBoot, isLoggedIn, loadBoot } from "./boot";

afterEach(() => {
	delete window.boot;
	delete window.csrf_token;
	vi.unstubAllGlobals();
});

describe("loadBoot", () => {
	it("uses the boot data the page already has", async () => {
		window.boot = { user: "staff@example.com" };
		const fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);

		expect((await loadBoot()).user).toBe("staff@example.com");
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("fetches boot data on the dev server and keeps the CSRF token", async () => {
		const message = { user: "admin@example.com", csrf_token: "abc" };
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({ ok: true, json: async () => ({ message }) }),
		);

		await loadBoot();
		expect(getBoot().user).toBe("admin@example.com");
		expect(window.csrf_token).toBe("abc");
	});

	it("treats an error as a Guest", async () => {
		vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

		await loadBoot();
		expect(isLoggedIn()).toBe(false);
	});
});
