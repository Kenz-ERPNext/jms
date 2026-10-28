import { afterEach, describe, expect, it, vi } from "vitest";

import { callMethod, errorMessage, FrappeError } from "./frappe";

const reply = (status: number, body: object) =>
	vi
		.fn()
		.mockResolvedValue({ ok: status < 400, status, statusText: "", json: async () => body });

afterEach(() => {
	vi.unstubAllGlobals();
	delete window.csrf_token;
});

describe("callMethod", () => {
	it("posts JSON with the CSRF token and returns message", async () => {
		window.csrf_token = "tok";
		const fetchMock = reply(200, { message: { ok: 1 } });
		vi.stubGlobal("fetch", fetchMock);

		expect(await callMethod("jms.api.x", { a: 1 })).toEqual({ ok: 1 });
		const [url, init] = fetchMock.mock.calls[0];
		expect(String(url)).toContain("/api/method/jms.api.x");
		expect(init.headers["X-Frappe-CSRF-Token"]).toBe("tok");
		expect(init.body).toBe('{"a":1}');
	});

	it("sends GET arguments in the query string", async () => {
		const fetchMock = reply(200, { message: "Guest" });
		vi.stubGlobal("fetch", fetchMock);

		await callMethod("frappe.auth.get_logged_user", { f: [1] }, "GET");
		expect(String(fetchMock.mock.calls[0][0])).toContain("f=%5B1%5D");
	});

	it("throws FrappeError with status and the server message", async () => {
		vi.stubGlobal(
			"fetch",
			reply(401, { message: "Invalid Login Credentials", exc_type: "AuthenticationError" }),
		);

		const error = await callMethod<never>("login").catch((e: FrappeError) => e);
		expect(error).toBeInstanceOf(FrappeError);
		expect(error.status).toBe(401);
		expect(error.message).toBe("Invalid Login Credentials");
	});
});

describe("errorMessage", () => {
	it("reads _server_messages and strips HTML", () => {
		const body = {
			_server_messages: JSON.stringify([
				JSON.stringify({ message: "<b>Not</b> permitted" }),
			]),
		};
		expect(errorMessage(body)).toBe("Not permitted");
	});

	it("falls back to the exception text", () => {
		expect(errorMessage({ exception: "frappe.exceptions.ValidationError: Bad tab" })).toBe(
			"Bad tab",
		);
	});
});
