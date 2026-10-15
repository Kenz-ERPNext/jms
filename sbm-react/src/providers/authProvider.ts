// Login, logout and session checks for Refine, using Frappe's own login API.
// Login and logout reload the page, so the server hands out fresh boot data and CSRF token.

import type { AuthProvider } from "@refinedev/core";

import { getBoot, isLoggedIn } from "@/lib/boot";
import { callMethod, FrappeError, request } from "@/lib/frappe";
import { afterLoginPath, LOGIN } from "@/lib/redirect";

export const RESET_SENT =
	"If this email is registered, we have sent a password reset link to it. Please check your inbox.";

interface LoginParams {
	email: string;
	password: string;
}

export const authProvider: AuthProvider = {
	login: async ({ email, password }: LoginParams) => {
		try {
			const body = await request("login", { usr: email, pwd: password });
			if (body.verification) {
				return failure(
					"Login failed",
					"Two-factor login is on. Use the ERPNext login: /login?desk=1",
				);
			}
			window.location.assign(afterLoginPath(window.location.search));
			return { success: true };
		} catch (error) {
			return failure("Login failed", messageOf(error, "Wrong email or password"));
		}
	},

	logout: async () => {
		await request("logout").catch(() => undefined);
		window.location.assign(LOGIN);
		return { success: true };
	},

	check: async () =>
		isLoggedIn() ? { authenticated: true } : { authenticated: false, redirectTo: LOGIN },

	onError: async (error) => {
		const status = error?.status ?? error?.statusCode;
		// 403 is also a normal "not permitted"; only log out when the session is gone.
		if (status === 401 || (status === 403 && !(await sessionAlive()))) {
			return { logout: true, redirectTo: LOGIN };
		}
		return { error };
	},

	getIdentity: async () => {
		const boot = getBoot();
		return isLoggedIn(boot) ? { id: boot.user, name: boot.full_name || boot.user } : null;
	},

	getPermissions: async () => getBoot().roles ?? [],

	forgotPassword: async ({ email }: { email: string }) => {
		try {
			await request("frappe.core.doctype.user.user.reset_password", { user: email });
			return { success: true };
		} catch (error) {
			return failure(
				"Could not send the reset link",
				messageOf(error, "Please try again later"),
			);
		}
	},
};

async function sessionAlive(): Promise<boolean> {
	const user = await callMethod<string>("frappe.auth.get_logged_user", {}, "GET").catch(
		() => "Guest",
	);
	return user !== "Guest";
}

// Refine shows this as an error notification: name is the title, message the text.
function failure(title: string, message: string) {
	return { success: false, error: { name: title, message } };
}

function messageOf(error: unknown, fallback: string): string {
	return error instanceof FrappeError || error instanceof Error ? error.message : fallback;
}
