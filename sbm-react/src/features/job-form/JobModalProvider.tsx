// Lets any page open the job modal: openJob() for a new job, openJob(name) for one.

import { createContext, useContext, useState, type ReactNode } from "react";

import JobModal from "./JobModal";

type OpenJob = (name?: string) => void;

const JobModalContext = createContext<OpenJob>(() => undefined);

export function JobModalProvider({ children }: { children: ReactNode }) {
	const [state, setState] = useState<{ open: boolean; name?: string }>({ open: false });
	const openJob: OpenJob = (name) => setState({ open: true, name });

	return (
		<JobModalContext.Provider value={openJob}>
			{children}
			<JobModal
				key={state.name ?? "new"}
				open={state.open}
				name={state.name}
				onClose={() => setState({ open: false })}
			/>
		</JobModalContext.Provider>
	);
}

export function useOpenJob(): OpenJob {
	return useContext(JobModalContext);
}
