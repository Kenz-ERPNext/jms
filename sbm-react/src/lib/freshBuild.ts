// A tab opened before a new build still runs the old files; the next page it opens
// may then fail (its chunk is gone, or new and old code mix). Reload once to get
// the new build. A short guard stops a reload loop if the page fails anyway.

const SBM_JS = "/assets/jms/sbm/sbm.js";
const GUARD = "sbm-reloaded-at";
let startChunk = "";

/** Remembers which build this tab runs (the file name of its start chunk). */
export function rememberBuild(chunkUrl: string) {
	startChunk = new URL(chunkUrl).pathname.split("/").pop() ?? "";
}

function reloadOnce() {
	try {
		const last = Number(sessionStorage.getItem(GUARD)) || 0;
		if (Date.now() - last < 10_000) return;
		sessionStorage.setItem(GUARD, String(Date.now()));
	} catch {
		// no storage: still reload, the old files are the likelier problem
	}
	window.location.reload();
}

/** Reloads when the server has a newer build than this tab runs. */
export async function reloadIfNewBuild() {
	if (!startChunk) return;
	try {
		const res = await fetch(SBM_JS, { cache: "no-store" });
		if (res.ok && !(await res.text()).includes(startChunk)) reloadOnce();
	} catch {
		// offline: keep showing the error
	}
}

/** A lazy page's file could not be loaded: most often a newer build replaced it. */
export function reloadOnChunkError() {
	window.addEventListener("vite:preloadError", (e) => {
		e.preventDefault();
		reloadOnce();
	});
}
