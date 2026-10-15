// Calls to the Frappe API (/api/method/... and /api/resource/...). Adds the CSRF
// token and turns a Frappe error into one readable message.

/** Also a Refine HttpError (message + statusCode), so Refine can show it. */
export class FrappeError extends Error {
	constructor(
		message: string,
		readonly status: number,
		readonly excType?: string,
	) {
		super(message);
		this.name = "FrappeError";
	}

	get statusCode(): number {
		return this.status;
	}
}

export interface FrappeBody {
	message?: unknown;
	data?: unknown;
	exc_type?: string;
	exception?: string;
	_server_messages?: string;
	[key: string]: unknown;
}

type Args = Record<string, unknown>;
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

interface FetchOptions {
	method?: HttpMethod;
	/** Query string; non-strings are sent as JSON, undefined values are left out. */
	query?: Args;
	body?: unknown;
}

/** Any API call by path. Throws FrappeError when it fails. */
export async function apiFetch(path: string, options: FetchOptions = {}): Promise<FrappeBody> {
	const { method = "GET", query = {}, body } = options;
	const url = new URL(path, window.location.origin);
	for (const [key, value] of Object.entries(query)) {
		if (value === undefined) continue;
		url.searchParams.set(key, typeof value === "string" ? value : JSON.stringify(value));
	}

	const headers: Record<string, string> = { Accept: "application/json" };
	if (method !== "GET") headers["X-Frappe-CSRF-Token"] = window.csrf_token ?? "";
	if (body !== undefined) headers["Content-Type"] = "application/json";

	const res = await fetch(url, {
		method,
		headers,
		body: body === undefined ? undefined : JSON.stringify(body),
		credentials: "same-origin",
	});
	const data: FrappeBody = await res.json().catch(() => ({}));
	if (!res.ok)
		throw new FrappeError(errorMessage(data, res.statusText), res.status, data.exc_type);
	return data;
}

/** The whole JSON body of a method call. */
export function request(
	method: string,
	args: Args = {},
	httpMethod: "GET" | "POST" = "POST",
): Promise<FrappeBody> {
	const path = `/api/method/${method}`;
	return httpMethod === "GET"
		? apiFetch(path, { query: args })
		: apiFetch(path, { method: "POST", body: args });
}

/** Only the `message` of a call: what the Python function returned. */
export async function callMethod<T>(
	method: string,
	args: Args = {},
	httpMethod: "GET" | "POST" = "POST",
): Promise<T> {
	return (await request(method, args, httpMethod)).message as T;
}

/** Frappe puts user messages in _server_messages: a JSON list of JSON strings. */
export function errorMessage(data: FrappeBody, fallback = ""): string {
	try {
		const list: string[] = JSON.parse(data._server_messages ?? "[]");
		const messages = list.map(readServerMessage).filter(Boolean);
		if (messages.length) return toText(messages.join("\n"));
	} catch {
		// not a list: fall through to the other fields
	}
	if (typeof data.message === "string" && data.message) return toText(data.message);
	if (data.exception) return data.exception.replace(/^[\w.]+:\s*/, "");
	return fallback || "Something went wrong";
}

function readServerMessage(raw: string): string {
	try {
		return JSON.parse(raw).message ?? "";
	} catch {
		return raw;
	}
}

/** Server messages may contain HTML; show only the text. */
function toText(html: string): string {
	return new DOMParser().parseFromString(html, "text/html").body.textContent?.trim() ?? html;
}
