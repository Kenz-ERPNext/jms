// Cancel and Amend for a job's invoices and payments, as in ERPNext. Cancel asks first
// and, like the desk, also cancels the submitted documents that hang on it (with the
// same doctypes left alone as ERPNext's forms leave). Amend opens the Create form that
// makes that kind of document, filled in from the cancelled one (amend.ts); saving it
// makes the amendment (X-1).

import { useQueryClient } from "@tanstack/react-query";
import { CloseCircleOutlined, EditOutlined } from "@ant-design/icons";
import { App, Button, Tooltip } from "antd";
import { useRef, useState, type ReactNode } from "react";

import { apiFetch, callMethod } from "@/lib/frappe";
import { tokens } from "@/theme/tokens";

import ActionModal from "./ActionModal";
import { amendAction, amendValues, type Doc } from "./amend";
import type { AmendOf, Values } from "./types";

// ignore_doctypes_on_cancel_all of ERPNext's sales_invoice.js, purchase_invoice.js
// and payment_entry.js: an invoice's payments are unlinked, not cancelled
const LEDGER = [
	"Journal Entry",
	"Repost Payment Ledger",
	"Repost Accounting Ledger",
	"Unreconcile Payment",
	"Unreconcile Payment Entries",
	"Bank Transaction",
];
const KEEP_ON_CANCEL: Record<string, string[]> = {
	"Sales Invoice": [
		...LEDGER,
		"Payment Entry",
		"POS Invoice",
		"Timesheet",
		"POS Invoice Merge Log",
		"POS Closing Entry",
		"Serial and Batch Bundle",
		"Packing Slip",
	],
	"Purchase Invoice": [
		...LEDGER,
		"Payment Entry",
		"Purchase Invoice",
		"Serial and Batch Bundle",
	],
	"Payment Entry": [...LEDGER, "Sales Invoice", "Purchase Invoice"],
};

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** cancel and amend for one job's documents, a table column with their buttons, and
 * the amend form to render (amendModal). */
export function useDocAmend(job: string) {
	const { modal, message } = App.useApp();
	const queryClient = useQueryClient();
	const [amending, setAmending] = useState<{
		action: string;
		amend: AmendOf & { values: Values };
	}>();

	const amend = async (doctype: string, name: string) => {
		try {
			const body = await apiFetch(
				`/api/resource/${encodeURIComponent(doctype)}/${encodeURIComponent(name)}`,
			);
			const doc = body.data as Doc;
			// an expense invoice's item is its Expense Type's item
			const item = doc.doctype === "Purchase Invoice" ? doc.items?.[0] : undefined;
			if (item) {
				const types = await callMethod<{ name: string }[]>("frappe.client.get_list", {
					doctype: "Expense Type",
					filters: { item: item.item_code },
					fields: ["name"],
					limit_page_length: 1,
				});
				item.expense_type = types?.[0]?.name;
			}
			const action = amendAction(doc);
			if (!action) throw new Error(`${name} was not made by a job action`);
			setAmending({ action, amend: { doctype, name, values: amendValues(action, doc) } });
		} catch (e) {
			message.error(`Could not amend ${name}: ${errorText(e)}`);
		}
	};

	const docstatus = async (doctype: string, name: string) =>
		(
			await callMethod<{ docstatus?: number }>("frappe.client.get_value", {
				doctype,
				filters: name,
				fieldname: "docstatus",
			})
		)?.docstatus;

	const cancelled = (doctype: string, name: string) => {
		void queryClient.invalidateQueries();
		// as in ERPNext, a cancelled document is amended next
		modal.confirm({
			title: `${name} cancelled`,
			content: "Amend it now, to make it again with the right values?",
			okText: "Amend",
			cancelText: "Later",
			onOk: () => amend(doctype, name),
		});
	};

	// the document being cancelled: a second click (the list is read from the server
	// before the dialog opens) must not open a second dialog that cancels it again
	const busy = useRef<string>();

	const cancel = async (doctype: string, name: string) => {
		if (busy.current === name) return;
		busy.current = name;
		const done = () => (busy.current = undefined);
		const keep = JSON.stringify(KEEP_ON_CANCEL[doctype] ?? []);
		let linked: { doctype: string; name: string }[] = [];
		try {
			const res = await callMethod<{ docs?: { doctype: string; name: string }[] }>(
				"frappe.desk.form.linked_with.get_submitted_linked_docs",
				{ doctype, name, ignore_doctypes_on_cancel_all: keep },
			);
			linked = res?.docs ?? [];
		} catch (e) {
			done();
			return message.error(errorText(e));
		}
		modal.confirm({
			title: linked.length ? `Cancel ${name} and its linked documents?` : `Cancel ${name}?`,
			content: linked.length ? (
				<>
					These are cancelled with it:
					<ul style={{ margin: 0, paddingLeft: 20 }}>
						{linked.map((d) => (
							<li key={`${d.doctype}:${d.name}`}>
								{d.doctype} {d.name}
							</li>
						))}
					</ul>
				</>
			) : (
				"Its accounting entries are reversed. You can amend it afterwards."
			),
			okText: linked.length ? "Cancel all" : "Cancel it",
			okButtonProps: { danger: true },
			cancelText: "Back",
			onCancel: done,
			onOk: async () => {
				try {
					// cancelled meanwhile (another tab, the desk): nothing left to do
					if ((await docstatus(doctype, name)) !== 2) {
						if (linked.length) {
							await callMethod(
								"frappe.desk.form.linked_with.cancel_all_linked_docs",
								{
									docs: JSON.stringify(linked),
									ignore_doctypes_on_cancel_all: keep,
								},
							);
						}
						await callMethod("frappe.client.cancel", { doctype, name });
					}
				} catch (e) {
					message.error(`Could not cancel ${name}: ${errorText(e)}`);
					return;
				} finally {
					done();
				}
				cancelled(doctype, name);
			},
		});
	};

	const amendModal = amending && (
		<ActionModal
			job={job}
			action={amending.action}
			amend={amending.amend}
			onClose={() => setAmending(undefined)}
		/>
	);

	/** Cancel on a submitted document, Amend on a cancelled one: icon buttons, as the
	 * job list's actions (Cancel in red, Amend as Edit). */
	const icon = (title: string, glyph: ReactNode, color: string, onClick: () => void) => (
		<Tooltip title={title}>
			<Button
				size="small"
				type="text"
				aria-label={title}
				icon={glyph}
				style={{ color }}
				onClick={onClick}
			/>
		</Tooltip>
	);
	const column = {
		title: "Actions",
		align: "center" as const,
		render: (_: unknown, r: { doctype: string; name: string; docstatus: number }) =>
			r.docstatus === 1
				? icon("Cancel", <CloseCircleOutlined />, tokens.color.danger, () =>
						cancel(r.doctype, r.name),
					)
				: r.docstatus === 2
					? icon("Amend", <EditOutlined />, tokens.color.info, () =>
							amend(r.doctype, r.name),
						)
					: null,
	};

	return { cancel, amend, amendModal, column };
}
