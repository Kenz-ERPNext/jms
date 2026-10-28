// The app frame: sider menu (from config/resources.tsx, filtered by role), header
// and the current page. Logout lives in the header menu, not in the sider.

import { ThemedLayout, ThemedSider } from "@refinedev/antd";
import { Grid } from "antd";
import { Outlet } from "react-router";

import { JobActionsProvider } from "@/features/job-actions/JobActionsProvider";
import { JobModalProvider } from "@/features/job-form/JobModalProvider";

import { tokens } from "@/theme/tokens";

import AppHeader from "./AppHeader";
import AppTitle from "./AppTitle";

// Below lg the sider is a drawer, opened by Refine's floating button at the top left.
const DRAWER_BUTTON_SPACE = 40;

export default function AppLayout() {
	const { lg } = Grid.useBreakpoint();
	return (
		<ThemedLayout
			Header={AppHeader}
			Title={AppTitle}
			Sider={() => <ThemedSider Title={AppTitle} fixed render={({ items }) => items} />}
		>
			<div
				style={{
					padding: tokens.space.xs,
					paddingLeft: lg ? tokens.space.xs : DRAWER_BUTTON_SPACE,
				}}
			>
				<JobModalProvider>
					<JobActionsProvider>
						<Outlet />
					</JobActionsProvider>
				</JobModalProvider>
			</div>
		</ThemedLayout>
	);
}
