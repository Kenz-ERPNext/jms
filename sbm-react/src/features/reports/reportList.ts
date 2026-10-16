// The reports SBM lists, by topic, each with one line saying what it shows, and who
// may open them (the same roles as each report's own Roles in ERPNext). The filters
// and columns come from the report itself (see lib/reportScript.ts).

import { ADMIN_ROLES, hasAnyRole, OFFICE_ROLES } from "@/lib/roles";

export const REPORT_GROUPS: {
	title: string;
	roles: readonly string[];
	reports: { name: string; hint: string }[];
}[] = [
	{
		title: "Work",
		// task reports: admins; Accounts users see only money and profit
		roles: ADMIN_ROLES,
		reports: [
			{
				name: "Job Status Report",
				hint: "Every job with its stage and what is still to do",
			},
			{ name: "Work In Progress", hint: "Jobs whose tasks are not finished" },
			{ name: "Pending Tasks", hint: "Tasks waiting, with the reason" },
			{ name: "Outsourcing Pending Tasks", hint: "Outsourced tasks not done or not billed" },
			{ name: "Employee Task Report", hint: "Tasks per employee" },
		],
	},
	{
		title: "Money",
		roles: OFFICE_ROLES,
		reports: [
			{ name: "Cash Collection", hint: "Money received and paid back, by day" },
			{ name: "Job Collection Report", hint: "Billed, received and due per job" },
			{ name: "Outstanding Receivable", hint: "What customers still owe" },
			{ name: "Job Supplier Payment Report", hint: "What was paid to suppliers per job" },
			{ name: "Day Business Summary Oasis", hint: "One day's business in summary" },
		],
	},
	{
		title: "Profit",
		roles: OFFICE_ROLES,
		reports: [
			{ name: "Job Profitability", hint: "Income, costs and profit per job" },
			{ name: "Job Gross Profit", hint: "Gross profit per job" },
			{ name: "Closed Job Profit", hint: "Profit of closed jobs, by closing date" },
			{ name: "Monthly Profit", hint: "Profit of closed jobs, per month" },
		],
	},
];

/** The groups the logged-in user may open. */
export const myReportGroups = () => REPORT_GROUPS.filter((g) => hasAnyRole(g.roles));

const ALL = REPORT_GROUPS.flatMap((g) => g.reports);

export const FIRST_REPORT = ALL[0].name;

/** A report's part of the URL: "Work In Progress" → "work-in-progress". */
export const reportSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export const reportBySlug = (slug?: string) => ALL.find((r) => reportSlug(r.name) === slug)?.name;

export const reportHint = (name: string) => ALL.find((r) => r.name === name)?.hint ?? "";
