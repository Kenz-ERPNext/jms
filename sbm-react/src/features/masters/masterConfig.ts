// What each master list shows: its DocType, columns, the fields the search looks in
// and any fixed filter. One list page (MasterListPage) serves them all.

import type { CrudFilter } from "@refinedev/core";

export interface MasterColumn {
	field: string;
	label: string;
	kind?: "check" | "datetime" | "date" | "money";
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
	/** Newest first instead of A–Z. */
	desc?: boolean;
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
	agents: {
		doctype: "Agent",
		title: "Agents",
		noun: "agents",
		columns: [
			{ field: "agent_name", label: "Agent" },
			{ field: "mobile", label: "Mobile" },
			{ field: "email", label: "Email" },
			{ field: "commission_type", label: "Commission" },
			{ field: "commission_rate", label: "Rate" },
			{ field: "is_active", label: "Active", kind: "check" },
		],
		search: ["agent_name", "mobile", "email"],
		sort: "agent_name",
	},
	services: {
		doctype: "Work Template",
		title: "Services",
		noun: "services",
		columns: [
			{ field: "template_code", label: "Code" },
			{ field: "description", label: "Description" },
			{ field: "job_type", label: "Job type" },
			{ field: "fee_price", label: "Gov fee", kind: "money" },
			{ field: "is_active", label: "Active", kind: "check" },
		],
		search: ["template_code", "description"],
		sort: "template_code",
	},
	"job-types": {
		doctype: "Job Type",
		title: "Job Types",
		noun: "job types",
		columns: [
			{ field: "job_type_name", label: "Job type" },
			{ field: "description", label: "Description" },
			{ field: "default_duration_days", label: "Days" },
			{ field: "is_active", label: "Active", kind: "check" },
		],
		search: ["job_type_name", "description"],
		sort: "job_type_name",
	},
	"job-natures": {
		doctype: "Job Nature",
		title: "Job Natures",
		noun: "job natures",
		columns: [
			{ field: "nature_name", label: "Job nature" },
			{ field: "job_type", label: "Job type" },
			{ field: "description", label: "Description" },
		],
		search: ["nature_name", "job_type"],
		sort: "nature_name",
	},
	"job-sources": {
		doctype: "Job Source",
		title: "Job Sources",
		noun: "job sources",
		columns: [
			{ field: "source_name", label: "Job source" },
			{ field: "is_agent_required", label: "Agent needed", kind: "check" },
		],
		search: ["source_name"],
		sort: "source_name",
	},
	"task-templates": {
		doctype: "Job Task Template",
		title: "Job Task Templates",
		noun: "templates",
		columns: [
			{ field: "task_name", label: "Task" },
			{ field: "job_type", label: "Job type" },
			{ field: "days_from_start", label: "Days from start" },
			{ field: "default_assignee", label: "Default assignee" },
		],
		search: ["task_name", "job_type"],
		sort: "job_type",
	},
	// not in the Masters menu: opened from Reports > Money
	"journal-entries": {
		doctype: "Journal Entry",
		title: "Journal Entries",
		noun: "entries",
		columns: [
			{ field: "name", label: "Entry" },
			{ field: "posting_date", label: "Date", kind: "date" },
			{ field: "voucher_type", label: "Type" },
			{ field: "total_debit", label: "Amount", kind: "money" },
			{ field: "user_remark", label: "Remark" },
		],
		search: ["name", "user_remark"],
		filters: [{ field: "docstatus", operator: "eq", value: 1 }],
		sort: "posting_date",
		desc: true,
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
