// Startup data from the server: who is logged in and what they may see.
// Production: jms/www/sbm.html puts it on window. Dev server: fetched from get_boot.

export interface Boot {
	user: string;
	full_name?: string;
	roles?: string[];
	is_office?: boolean;
	is_task_staff?: boolean;
	/** May open the ERPNext desk (only the Administrator; jms/desk_access.py). */
	desk?: boolean;
	employees?: string[];
	company?: string;
	currency?: string;
	settings?: Record<string, number>;
	csrf_token?: string;
}

declare global {
	interface Window {
		boot?: Boot;
		csrf_token?: string;
	}
}

const GUEST: Boot = { user: "Guest" };

export function getBoot(): Boot {
	return window.boot ?? GUEST;
}

export function isLoggedIn(boot: Boot = getBoot()): boolean {
	return boot.user !== "Guest";
}

/** Make sure window.boot and window.csrf_token are set before the app starts. */
export async function loadBoot(): Promise<Boot> {
	if (window.boot) return window.boot;
	const res = await fetch("/api/method/jms.api.boot.get_boot", {
		headers: { Accept: "application/json" },
	});
	// A Guest is not allowed to call get_boot, so any error means: not logged in.
	const boot: Boot = res.ok ? (await res.json()).message : GUEST;
	window.boot = boot;
	window.csrf_token = boot.csrf_token;
	return boot;
}

/** Links into the ERPNext desk are shown only to users who may open it. */
export const canUseDesk = () => !!getBoot().desk;
