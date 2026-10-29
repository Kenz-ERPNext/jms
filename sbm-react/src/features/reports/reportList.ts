// The reports SBM lists, by topic, each with one line saying what it shows, and who
// may open them (the same roles as each report's own Roles in ERPNext). The filters
// and columns come from the report itself (see lib/reportScript.ts).

import { ADMIN_ROLES, hasAnyRole, OFFICE_ROLES } from "@/lib/roles";

export interface ReportItem {
	/** The report's name in ERPNext. */
	name: string;
	/** Shorter name for the card, when the ERPNext one is long. */
	label?: string;
	/** The question the report answers, so the right one is found at a glance. */
	hint: string;
	/** A master list (features/masters/masterConfig.ts) instead of a report. */
	list?: string;
}

export const REPORT_GROUPS: {
	title: string;
	about: string;
	roles: readonly string[];
	reports: ReportItem[];
}[] = [
	{
		title: "Work",
		about: "Jobs and tasks: what is done, what is waiting and who has it",
		// task reports: admins; Accounts users see only money and profit
		roles: ADMIN_ROLES,
		reports: [
			{ name: "Job Status Report", hint: "Where is each job, and what is left?" },
			{ name: "Work In Progress", hint: "Which jobs still have open tasks?" },
			{ name: "Pending Tasks", hint: "Which tasks are stuck, and why?" },
			{
				name: "Outsourcing Pending Tasks",
				hint: "Which outside work is not done or billed?",
			},
			{ name: "Employee Task Report", hint: "How many tasks does each person have?" },
		],
	},
	{
		title: "Money",
		about: "Money coming in, money going out and what is still owed",
		roles: OFFICE_ROLES,
		reports: [
			{ name: "Cash Collection", hint: "How much came in each day?" },
			{ name: "Job Collection Report", hint: "Per job: billed, received and due" },
			{ name: "Outstanding Receivable", hint: "Who still owes us, and how much?" },
			{ name: "Job Supplier Payment Report", hint: "What did we pay suppliers per job?" },
			{
				name: "Day Business Summary Oasis",
				label: "Day Business Summary",
				hint: "One day's sales, purchases and payments",
			},
			{ name: "General Ledger", hint: "Every posting to an account, with its balance" },
			{
				name: "Journal Entries",
				hint: "All posted journal entries",
				list: "journal-entries",
			},
		],
	},
	{
		title: "Profit",
		about: "What each job and each month earned after costs",
		roles: OFFICE_ROLES,
		reports: [
			{ name: "Job Profitability", hint: "Income, costs and profit of every job" },
			{ name: "Job Gross Profit", hint: "Gross profit of every job" },
			{ name: "Closed Job Profit", hint: "Profit of jobs closed in a period" },
			{ name: "Monthly Profit", hint: "How much profit each month?" },
		],
	},
];

/** The groups the logged-in user may open. */
export const myReportGroups = () => REPORT_GROUPS.filter((g) => hasAnyRole(g.roles));

const ALL = REPORT_GROUPS.flatMap((g) => g.reports);

export const FIRST_REPORT = ALL[0].name;

/** A report's part of the URL: "Work In Progress" → "work-in-progress". */
export const reportSlug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

export const reportBySlug = (slug?: string) => ALL.find((r) => reportSlug(r.name) === slug);

export const reportHint = (name: string) => ALL.find((r) => r.name === name)?.hint ?? "";
