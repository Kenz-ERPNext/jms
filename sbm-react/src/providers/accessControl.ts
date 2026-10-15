// Which menu items and pages a user may see, from the roles in config/resources.tsx.
// Only shapes the UI: the server checks permissions on every call.

import type { AccessControlProvider } from "@refinedev/core";

import { findResource } from "@/config/resources";
import { hasAnyRole } from "@/lib/roles";

export const accessControlProvider: AccessControlProvider = {
	can: async ({ resource }) => {
		const config = findResource(resource);
		if (!config) return { can: true };
		return hasAnyRole(config.roles)
			? { can: true }
			: { can: false, reason: "You do not have access to this page" };
	},
	options: { buttons: { hideIfUnauthorized: true } },
};
