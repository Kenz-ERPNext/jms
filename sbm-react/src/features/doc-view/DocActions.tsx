// Submit on a draft, Cancel on a submitted document (with the documents that hang on
// it, as in ERPNext) and Amend on a cancelled one: a Journal Entry in the SBM form, a
// job's invoice or payment in its job action form. Other doctypes are amended in the desk.

import { CheckCircleOutlined, CloseCircleOutlined, EditOutlined } from "@ant-design/icons";
import { useQueryClient } from "@tanstack/react-query";
import { App, Button } from "antd";

import { useDocAmend } from "@/features/job-actions/docAmend";
import { fromDoc } from "@/features/journal-entry/journalEntry";
import { callMethod } from "@/lib/frappe";

import { useOpenJournalEntry } from "./DocViewProvider";
import type { Doc, DocMeta } from "./docView";

const JOB_DOCS = ["Sales Invoice", "Purchase Invoice", "Payment Entry"];

export default function DocActions({
	doctype,
	doc,
	meta,
	onLeave,
}: {
	doctype: string;
	doc: Doc;
	meta: DocMeta;
	/** Close the drawer (the amend form takes over). */
	onLeave: () => void;
}) {
	const { modal, message } = App.useApp();
	const queryClient = useQueryClient();
	const openJournalEntry = useOpenJournalEntry();
	const { cancel, amend, amendModal } = useDocAmend(undefined, {
		onAmendJournal: (d) => {
			onLeave();
			openJournalEntry({ values: fromDoc(d), amendedFrom: d.name });
		},
	});
	if (!meta.is_submittable) return null;

	const submit = () =>
		modal.confirm({
			title: `Submit ${doc.name}?`,
			content: "Its accounting entries are posted. To change it later, cancel and amend it.",
			okText: "Submit",
			onOk: async () => {
				try {
					await callMethod("frappe.client.submit", {
						doc: JSON.stringify({ ...doc, doctype }),
					});
					message.success(`${doc.name} submitted`);
					void queryClient.invalidateQueries();
				} catch (e) {
					message.error(e instanceof Error ? e.message : String(e));
				}
			},
		});

	// amending a job's invoice or payment needs its job; others are amended in the desk
	const amendable =
		doctype === "Journal Entry" ||
		(JOB_DOCS.includes(doctype) && !!(doc.job || doc.custom_job));
	const { name } = doc;
	let button = null;
	if (doc.docstatus === 0) {
		button = (
			<Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={submit}>
				Submit
			</Button>
		);
	} else if (doc.docstatus === 1) {
		button = (
			<Button
				size="small"
				danger
				icon={<CloseCircleOutlined />}
				onClick={() => cancel(doctype, name)}
			>
				Cancel
			</Button>
		);
	} else if (doc.docstatus === 2 && amendable) {
		button = (
			<Button size="small" icon={<EditOutlined />} onClick={() => amend(doctype, name)}>
				Amend
			</Button>
		);
	}

	return (
		<>
			{button}
			{amendModal}
		</>
	);
}
