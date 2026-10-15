// A logged-in user on a login page goes where ?redirect-to / ?to says, or home.
// SBM paths stay in the React router; others (e.g. /app/...) are a full page load.

import { useEffect } from "react";
import { Navigate, useLocation } from "react-router";

import { afterLoginPath, isAppPath } from "@/lib/redirect";

export default function GoAfterLogin() {
	const target = afterLoginPath(useLocation().search);
	const inApp = isAppPath(target);

	useEffect(() => {
		if (!inApp) window.location.replace(target);
	}, [inApp, target]);

	return inApp ? <Navigate to={target} replace /> : null;
}
