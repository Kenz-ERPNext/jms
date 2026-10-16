// Every menu item in one place: Refine resource, path, icon, who may see it and the
// task that builds the page. Adding a page = adding an entry here (and its component).
// For DocType pages the resource name is the DocType, which the data provider uses.

import {
	AppstoreOutlined,
	AuditOutlined,
	BarChartOutlined,
	CheckSquareOutlined,
	DashboardOutlined,
	DatabaseOutlined,
	FileTextOutlined,
} from "@ant-design/icons";
import type { ResourceProps } from "@refinedev/core";
import { lazy, type ComponentType, type LazyExoticComponent, type ReactNode } from "react";

import { HOME } from "@/lib/redirect";
import { ADMIN_ROLES, ALL_ROLES, OFFICE_ROLES } from "@/lib/roles";

export interface AppResource {
	name: string;
	label: string;
	/** Path of the page; none for a menu group. */
	path?: string;
	icon?: ReactNode;
	parent?: string;
	roles: readonly string[];
	/** Plan task that builds the page (docs/REACT_FRONTEND_PLAN.md). */
	task?: string;
	/** The page, loaded when first opened. Without one the page shows "coming". */
	page?: LazyExoticComponent<ComponentType>;
	/** Page for one record, at <path>/<name> (the name may contain "/"). */
	detail?: LazyExoticComponent<ComponentType>;
}

// Masters: one list page for all, picked by the path (features/masters/masterConfig.ts).
const MasterListPage = lazy(() => import("@/features/masters/MasterListPage"));
const master = (
	name: string,
	label: string,
	slug: string,
	roles: readonly string[] = OFFICE_ROLES,
): AppResource => ({
	name,
	label,
	page: MasterListPage,
	path: `${HOME}/masters/${slug}`,
	parent: "masters",
	roles,
	task: "FE-6",
});

export const appResources: AppResource[] = [
	{
		name: "dashboard",
		label: "Dashboard",
		page: lazy(() => import("@/features/dashboard/DashboardPage")),
		path: `${HOME}/dashboard`,
		icon: <DashboardOutlined />,
		// office users see the business, Task Staff their own tasks
		roles: ALL_ROLES,
		task: "FE-13",
	},
	{
		name: "Job",
		label: "Jobs",
		page: lazy(() => import("@/features/jobs/JobsListPage")),
		detail: lazy(() => import("@/features/job/JobPage")),
		path: `${HOME}/jobs`,
		icon: <FileTextOutlined />,
		roles: OFFICE_ROLES,
		task: "FE-7",
	},
	{
		name: "my-tasks",
		label: "My Tasks",
		page: lazy(() => import("@/features/my-tasks/MyTasksPage")),
		path: `${HOME}/my-tasks`,
		icon: <CheckSquareOutlined />,
		roles: ALL_ROLES,
		task: "FE-12",
	},
	{
		name: "task-board",
		label: "Task Board",
		page: lazy(() => import("@/features/task-board/TaskBoardPage")),
		path: `${HOME}/task-board`,
		icon: <AppstoreOutlined />,
		roles: ADMIN_ROLES,
		task: "FE-14",
	},
	{
		name: "reports",
		label: "Reports",
		page: lazy(() => import("@/features/reports/ReportsPage")),
		path: `${HOME}/reports`,
		icon: <BarChartOutlined />,
		roles: OFFICE_ROLES,
		task: "FE-15",
	},
	{ name: "masters", label: "Masters", icon: <DatabaseOutlined />, roles: OFFICE_ROLES },
	master("Customer", "Customers", "customers"),
	master("Employee", "Employees", "employees"),
	master("Outsourced Party", "Outsourced Parties", "outsourced-parties"),
	master("User", "Users", "users", ADMIN_ROLES),
	{
		name: "activity-log",
		label: "Activity Log",
		page: lazy(() => import("@/features/activity-log/ActivityLogPage")),
		path: `${HOME}/activity-log`,
		icon: <AuditOutlined />,
		// who may read the Accounting Change Log
		roles: [...ADMIN_ROLES, "Accounts Manager", "Auditor"],
		task: "FE-16",
	},
];

/** The same list in Refine's shape (drives the sider menu). */
export const refineResources: ResourceProps[] = appResources.map((r) => ({
	name: r.name,
	list: r.path,
	show: r.detail ? `${r.path}/:id` : undefined,
	meta: { label: r.label, icon: r.icon, parent: r.parent },
}));

export function findResource(name?: string): AppResource | undefined {
	return appResources.find((r) => r.name === name);
}
