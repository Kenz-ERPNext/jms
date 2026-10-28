// Links shared by pages.

import { HOME } from "./redirect";

/** Jobs list, optionally on one tab (a stage, "Overdue" or "Closed"). */
export function jobsPath(tab?: string): string {
	return tab ? `${HOME}/jobs?tab=${encodeURIComponent(tab)}` : `${HOME}/jobs`;
}

/** One job in SBM. A job name may contain "/" (JOB-6004/26); it stays readable. */
export function jobPath(name: string): string {
	return `${HOME}/jobs/${name.split("/").map(encodeURIComponent).join("/")}`;
}

/** Any document in the ERPNext desk (for desk roles). */
export function deskPath(doctype: string, name: string): string {
	const slug = doctype.toLowerCase().replace(/ /g, "-");
	return `/app/${slug}/${encodeURIComponent(name)}`;
}

/** Frappe print view of a job in the "Job Print Format" (opens the print dialog). */
export function printPath(name: string): string {
	const q = new URLSearchParams({
		doctype: "Job",
		name,
		format: "Job Print Format",
		trigger_print: "1",
	});
	return `/printview?${q}`;
}

export function openPrint(name: string) {
	window.open(printPath(name), "_blank", "noopener");
}
