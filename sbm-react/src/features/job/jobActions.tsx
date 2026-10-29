// What each job action is called and does. Close and Cancel save the Job with that
// status (the server checks the rules). The money actions get SBM forms in FE-11;
// until then they open the job in ERPNext, where the same buttons are.

import { useUpdate } from "@refinedev/core";
import { App, type MenuProps } from "antd";

import { tokens } from "@/theme/tokens";

export type ActionGroup = "create" | "job";
/** What a Create action is about, so its kind can be told apart by colour. */
export type ActionKind = "customer" | "outsource" | "expense";

// Names as on the ERPNext Job form: the "Create" menu, "Close Job" and "Cancel".
export const ACTION_TEXT: Record<
	string,
	{ label: string; group: ActionGroup; kind?: ActionKind }
> = {
	outsource_advance: { label: "Outsource Advance Payment", group: "create", kind: "outsource" },
	advance_receipt: { label: "Advance Receipt", group: "create", kind: "customer" },
	payment_return: { label: "Payment Return", group: "create", kind: "customer" },
	sales_invoice: { label: "Create Sales Invoice", group: "create", kind: "customer" },
	expense: { label: "Create Expense", group: "create", kind: "expense" },
	expense_return: { label: "Expense Return", group: "create", kind: "expense" },
	purchase_invoice: { label: "Create Purchase Invoice", group: "create", kind: "outsource" },
	close: { label: "Close Job", group: "job" },
	cancel: { label: "Cancel", group: "job" },
	tasks: { label: "Update tasks", group: "job" },
};

export const GROUP_TITLE: Record<ActionGroup, string> = {
	create: "Create",
	job: "Job",
};

/** Create actions by kind (customer, outsourcing, expense), in this order, with their colour. */
export const KIND: Record<ActionKind, { tint: string }> = {
	customer: { tint: tokens.color.success },
	outsource: { tint: tokens.color.info },
	expense: { tint: tokens.color.warning },
};

/** The Create menu items: the given actions kind by kind, each in its kind's colour. */
export function createMenuItems(keys: string[]): NonNullable<MenuProps["items"]> {
	return (Object.keys(KIND) as ActionKind[]).flatMap((kind) =>
		keys
			.filter((k) => ACTION_TEXT[k]?.kind === kind)
			.map((k) => ({
				key: k,
				label: <span style={{ color: KIND[kind].tint }}>{ACTION_TEXT[k].label}</span>,
			})),
	);
}

const CONFIRM = {
	close: {
		title: "Close this job?",
		content:
			"All tasks must be completed and the full amount received. Profit is counted from today.",
		status: "Closed",
		done: "Job closed",
	},
	cancel: {
		title: "Cancel this job?",
		content: "A cancelled job cannot be reopened from here.",
		status: "Cancelled",
		done: "Job cancelled",
	},
};

/** Close or cancel a job after a confirm; calls onDone when saved. */
export function useStatusAction(onDone: () => void) {
	const { modal } = App.useApp();
	const { mutate } = useUpdate();
	return (name: string, action: "close" | "cancel") => {
		const text = CONFIRM[action];
		modal.confirm({
			title: text.title,
			content: text.content,
			okText: action === "close" ? "Close job" : "Cancel job",
			okButtonProps: { danger: action === "cancel" },
			cancelText: "Back",
			onOk: () =>
				new Promise<void>((resolve) =>
					mutate(
						{
							resource: "Job",
							id: name,
							values: { status: text.status },
							successNotification: { type: "success", message: text.done },
							// the server says why (tasks open, money not received, ...)
							errorNotification: (error) => ({
								type: "error",
								message: `Could not ${action} the job`,
								description: error?.message,
							}),
						},
						{ onSettled: () => (resolve(), onDone()) },
					),
				),
		});
	};
}
