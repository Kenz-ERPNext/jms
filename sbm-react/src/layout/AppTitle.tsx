// The Kenz logo at the top of the sider (just its chevrons when collapsed).

import { Link } from "react-router";

import { LOGO, LOGO_MARK } from "@/lib/brand";
import { HOME } from "@/lib/redirect";

export default function AppTitle({ collapsed }: { collapsed: boolean }) {
	return (
		<Link to={HOME} style={{ display: "flex", alignItems: "center" }}>
			<img
				src={collapsed ? LOGO_MARK : LOGO}
				alt="Kenz Technology"
				height={collapsed ? 32 : 34}
			/>
		</Link>
	);
}
