// Refine setup: theme, router, auth, access control, notifications and the menu
// resources. Routes are in AppRoutes.tsx.

import { useNotificationProvider } from "@refinedev/antd";
import "@refinedev/antd/dist/reset.css";
import { Refine } from "@refinedev/core";
import routerProvider from "@refinedev/react-router";
import { App as AntdApp, ConfigProvider } from "antd";
import { BrowserRouter } from "react-router";

import AppRoutes from "@/AppRoutes";
import { refineResources } from "@/config/resources";
import { accessControlProvider } from "@/providers/accessControl";
import { authProvider } from "@/providers/authProvider";
import { dataProvider } from "@/providers/dataProvider";
import { antdTheme } from "@/theme/antdTheme";

export default function App() {
	return (
		<BrowserRouter>
			<ConfigProvider theme={antdTheme}>
				<AntdApp>
					<Refine
						routerProvider={routerProvider}
						dataProvider={dataProvider}
						authProvider={authProvider}
						accessControlProvider={accessControlProvider}
						notificationProvider={useNotificationProvider}
						resources={refineResources}
						options={{ disableTelemetry: true }}
					>
						<AppRoutes />
					</Refine>
				</AntdApp>
			</ConfigProvider>
		</BrowserRouter>
	);
}
