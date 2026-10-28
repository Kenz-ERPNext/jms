// What each job action is called and does. Close and Cancel save the Job with that
// status (the server checks the rules). The money actions get SBM forms in FE-11;
// until then they open the job in ERPNext, where the same buttons are.

import { useUpdate } from "@refinedev/core";
import { App } from "antd";

export type ActionGroup = "create" | "job";

// Names as on the ERPNext Job form: the "Create" menu, "Close Job" and "Cancel".
export const ACTION_TEXT: Record<string, { label: string; group: ActionGroup }> = {
	outsource_advance: { label: "Outsource Advance Payment", group: "create" },
	advance_receipt: { label: "Advance Receipt", group: "create" },
	payment_return: { label: "Payment Return", group: "create" },
	sales_invoice: { label: "Create Sales Invoice", group: "create" },
	expense: { label: "Create Expense", group: "create" },
	expense_return: { label: "Expense Return", group: "create" },
	purchase_invoice: { label: "Create Purchase Invoice", group: "create" },
	close: { label: "Close Job", group: "job" },
	cancel: { label: "Cancel", group: "job" },
	tasks: { label: "Update tasks", group: "job" },
};

export const GROUP_TITLE: Record<ActionGroup, string> = {
	create: "Create",
	job: "Job",
};

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
