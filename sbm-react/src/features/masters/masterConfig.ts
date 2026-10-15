// What each master list shows: its DocType, columns, the fields the search looks in
// and any fixed filter. One list page (MasterListPage) serves them all.

import type { CrudFilter } from "@refinedev/core";

export interface MasterColumn {
	field: string;
	label: string;
	kind?: "check" | "datetime";
}

export interface MasterConfig {
	doctype: string;
	title: string;
	/** What one row is ("customers"). */
	noun: string;
	columns: MasterColumn[];
	search: string[];
	filters?: CrudFilter[];
	sort?: string;
}

export const MASTERS: Record<string, MasterConfig> = {
	customers: {
		doctype: "Customer",
		title: "Customers",
		noun: "customers",
		columns: [
			{ field: "customer_name", label: "Customer" },
			{ field: "mobile_no", label: "Mobile" },
			{ field: "email_id", label: "Email" },
			{ field: "disabled", label: "Disabled", kind: "check" },
		],
		search: ["customer_name", "mobile_no", "email_id"],
		sort: "customer_name",
	},
	employees: {
		doctype: "Employee",
		title: "Employees",
		noun: "employees",
		columns: [
			{ field: "employee_name", label: "Employee" },
			{ field: "name", label: "ID" },
			{ field: "designation", label: "Designation" },
			{ field: "cell_number", label: "Mobile" },
			{ field: "user_id", label: "User" },
			{ field: "status", label: "Status" },
		],
		search: ["employee_name", "name", "cell_number"],
		sort: "employee_name",
	},
	"outsourced-parties": {
		doctype: "Outsourced Party",
		title: "Outsourced Parties",
		noun: "parties",
		columns: [
			{ field: "party_name", label: "Party" },
			{ field: "mobile", label: "Mobile" },
			{ field: "email", label: "Email" },
			{ field: "linked_supplier", label: "Supplier" },
			{ field: "is_active", label: "Active", kind: "check" },
		],
		search: ["party_name", "mobile", "email"],
		sort: "party_name",
	},
	users: {
		doctype: "User",
		title: "Users",
		noun: "users",
		columns: [
			{ field: "full_name", label: "Name" },
			{ field: "name", label: "Email / login" },
			{ field: "enabled", label: "Enabled", kind: "check" },
			{ field: "last_login", label: "Last login", kind: "datetime" },
		],
		search: ["full_name", "name"],
		// people who log in to the app, not website users or Guest
		filters: [
			{ field: "user_type", operator: "eq", value: "System User" },
			{ field: "name", operator: "nin", value: ["Administrator", "Guest"] },
		],
		sort: "full_name",
	},
};
