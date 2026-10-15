// Role groups, the same as the server (OFFICE_ROLES in job.py, DASHBOARD_ROLES in
// jms/api/dashboard.py). The server still checks every call; this only shapes the UI.

import { getBoot } from "./boot";
import { HOME } from "./redirect";

export const OFFICE_ROLES = [
	"Administrator",
	"System Manager",
	"Admin",
	"Accounts User",
	"Accounts Manager",
];
export const ADMIN_ROLES = ["Administrator", "System Manager", "Admin"];
/** Everyone logged in. */
export const ALL_ROLES: string[] = [];

/** True if the user has one of the roles; an empty list means everyone. */
export function hasAnyRole(
	allowed: readonly string[],
	roles: readonly string[] = getBoot().roles ?? [],
): boolean {
	return allowed.length === 0 || allowed.some((role) => roles.includes(role));
}

/** First page after login: office users get the Dashboard, Task Staff their tasks. */
export function homePath(roles: readonly string[] = getBoot().roles ?? []): string {
	return hasAnyRole(OFFICE_ROLES, roles) ? `${HOME}/dashboard` : `${HOME}/my-tasks`;
}
