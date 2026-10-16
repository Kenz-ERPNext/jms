// Where to go after login: ?redirect-to= (from ERPNext) or ?to= (from the SBM
// router), both full site paths such as /app/job/JOB-1 or /sbm/jobs.
// Only paths on this site are allowed, so a crafted link cannot send the user elsewhere.
// Desk users (System Manager, Admin) start in ERPNext; everyone else in SBM, and a
// desk page as target is not for them (the server would send them back anyway).

export const HOME = "/sbm";
export const LOGIN = "/login";
export const DESK_HOME = "/app";

export function afterLoginPath(
	search: string,
	origin = window.location.origin,
	desk = false,
): string {
	const home = desk ? DESK_HOME : HOME;
	const params = new URLSearchParams(search);
	const target = params.get("redirect-to") ?? params.get("to");
	if (!target) return home;

	let url: URL;
	try {
		url = new URL(target, origin);
	} catch {
		return home;
	}
	if (url.origin !== origin || isLoginPage(url.pathname) || isDeskHome(url.pathname))
		return home;
	if (!desk && isDeskPath(url.pathname)) return HOME;
	return url.pathname + url.search + url.hash;
}

/** A page of the ERPNext desk (the server lets only desk users in). */
function isDeskPath(path: string): boolean {
	return ["/app", "/apps", "/desk"].some((p) => path === p || path.startsWith(`${p}/`));
}

/** True for paths the React router shows; others (e.g. /app) need a full page load. */
export function isAppPath(path: string): boolean {
	return path === HOME || path.startsWith(`${HOME}/`) || path.startsWith(`${HOME}?`);
}

function isLoginPage(path: string): boolean {
	return path === LOGIN || path.startsWith(`${HOME}/login`);
}

/** The ERPNext desk home (/app) is where Frappe sends anyone without a page in mind;
 * SBM users start on the SBM home instead, as for the old SBM desk pages. Any other
 * desk page (/app/job/...) is kept. */
function isDeskHome(path: string): boolean {
	return [
		"/app",
		"/app/",
		"/desk",
		"/desk/",
		"/",
		// the old SBM pages in the desk; the React app replaces them
		"/app/jms-dashboard",
		"/app/sbm",
		"/app/sbm-pipeline",
	].includes(path.replace(/\/$/, "") || "/");
}
