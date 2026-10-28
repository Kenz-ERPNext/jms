import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authProvider } from "./authProvider";

const reply = (status: number, body: object) => ({
	ok: status < 400,
	status,
	statusText: "",
	json: async () => body,
});

let assign: ReturnType<typeof vi.fn>;

beforeEach(() => {
	assign = vi.fn();
	vi.stubGlobal("location", { ...window.location, origin: "http://site", search: "", assign });
});

afterEach(() => {
	vi.unstubAllGlobals();
	delete window.boot;
});

describe("authProvider", () => {
	it("logs in with Frappe and reloads into the app", async () => {
		const fetchMock = vi.fn().mockResolvedValue(reply(200, { message: "Logged In" }));
		vi.stubGlobal("fetch", fetchMock);

		const result = await authProvider.login({ email: "a@b.c", password: "pw" });
		expect(result.success).toBe(true);
		expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ usr: "a@b.c", pwd: "pw" });
		expect(assign).toHaveBeenCalledWith("/sbm");
	});

	it("returns the server message on a wrong password and stays on the page", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(reply(401, { message: "Invalid Login Credentials" })),
		);

		const result = await authProvider.login({ email: "a@b.c", password: "bad" });
		expect(result.success).toBe(false);
		expect(result.error?.message).toBe("Invalid Login Credentials");
		expect(assign).not.toHaveBeenCalled();
	});

	it("checks the session from the boot data", async () => {
		window.boot = { user: "Guest" };
		expect((await authProvider.check()).authenticated).toBe(false);
		window.boot = { user: "a@b.c" };
		expect((await authProvider.check()).authenticated).toBe(true);
	});

	it("logs out on 401, and on 403 only when the session is gone", async () => {
		expect((await authProvider.onError({ status: 401 })).logout).toBe(true);

		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(200, { message: "a@b.c" })));
		expect((await authProvider.onError({ status: 403 })).logout).toBeUndefined();

		vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(403, {})));
		expect((await authProvider.onError({ status: 403 })).logout).toBe(true);
	});
});
