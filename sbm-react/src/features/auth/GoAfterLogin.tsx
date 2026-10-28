// A logged-in user on a login page goes where ?redirect-to / ?to says, or home
// (ERPNext for desk users, SBM for everyone else).
// SBM paths stay in the React router; others (e.g. /app/...) are a full page load.

import { useEffect } from "react";
import { Navigate, useLocation } from "react-router";

import { canUseDesk } from "@/lib/boot";
import { afterLoginPath, isAppPath } from "@/lib/redirect";

export default function GoAfterLogin() {
	const target = afterLoginPath(useLocation().search, undefined, canUseDesk());
	const inApp = isAppPath(target);

	useEffect(() => {
		if (!inApp) window.location.replace(target);
	}, [inApp, target]);

	return inApp ? <Navigate to={target} replace /> : null;
}
