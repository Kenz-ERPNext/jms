// Lets any page show a document read-only in a drawer, openDoc(doctype, name), and
// start a Journal Entry in SBM, openJournalEntry() (or with a cancelled entry's
// values, to amend it). A link inside the drawer opens that document in the same
// drawer, with Back to return. A Job opens the job modal instead.

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

import { useOpenJob } from "@/features/job-form/JobModalProvider";
import JournalEntryModal from "@/features/journal-entry/JournalEntryModal";
import type { JeValues } from "@/features/journal-entry/journalEntry";

import DocViewDrawer from "./DocViewDrawer";

export type OpenDoc = (doctype: string, name: string) => void;
export type OpenJournalEntry = (amend?: { values: JeValues; amendedFrom: string }) => void;

const DocViewContext = createContext<{ openDoc: OpenDoc; openJournalEntry: OpenJournalEntry }>({
	openDoc: () => undefined,
	openJournalEntry: () => undefined,
});

export function DocViewProvider({ children }: { children: ReactNode }) {
	const openJob = useOpenJob();
	const [stack, setStack] = useState<{ doctype: string; name: string }[]>([]);
	const [je, setJe] = useState<{ open: boolean; values?: JeValues; amendedFrom?: string }>({
		open: false,
	});

	const open = useCallback(
		(doctype: string, name: string, push: boolean) => {
			if (doctype === "Job") return openJob(name);
			setStack((s) => (push ? [...s, { doctype, name }] : [{ doctype, name }]));
		},
		[openJob],
	);
	const openDoc: OpenDoc = useCallback((d, n) => open(d, n, false), [open]);
	const openJournalEntry: OpenJournalEntry = useCallback(
		(amend) => setJe({ open: true, values: amend?.values, amendedFrom: amend?.amendedFrom }),
		[],
	);

	const current = stack[stack.length - 1];
	return (
		<DocViewContext.Provider value={{ openDoc, openJournalEntry }}>
			{children}
			<DocViewDrawer
				current={current}
				canGoBack={stack.length > 1}
				onBack={() => setStack((s) => s.slice(0, -1))}
				onOpen={(d, n) => open(d, n, true)}
				onClose={() => setStack([])}
			/>
			<JournalEntryModal
				key={je.amendedFrom ?? "new"}
				open={je.open}
				initial={je.values}
				amendedFrom={je.amendedFrom}
				onClose={() => setJe({ open: false })}
				onSaved={(name) => {
					setJe({ open: false });
					openDoc("Journal Entry", name);
				}}
			/>
		</DocViewContext.Provider>
	);
}

export function useOpenDoc(): OpenDoc {
	return useContext(DocViewContext).openDoc;
}

export function useOpenJournalEntry(): OpenJournalEntry {
	return useContext(DocViewContext).openJournalEntry;
}
