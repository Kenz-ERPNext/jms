// The reports this browser opened last, so they are one click away on the Reports
// page. Kept in localStorage: a per-viewer convenience that may come back empty.

/** Reports this browser opened last, newest first (a convenience; may be empty). */
const RECENT_KEY = "sbm.recentReports";
const RECENT_MAX = 4;

export function readRecent(): string[] {
	try {
		return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]") as string[];
	} catch {
		return [];
	}
}

export function rememberRecent(slug: string) {
	try {
		const next = [slug, ...readRecent().filter((s) => s !== slug)].slice(0, RECENT_MAX);
		localStorage.setItem(RECENT_KEY, JSON.stringify(next));
	} catch {
		// private window or blocked storage: nothing to remember
	}
}
