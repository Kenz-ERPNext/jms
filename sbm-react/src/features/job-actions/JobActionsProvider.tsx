// Lets any page run a job action: runAction(job, key). Money actions open their
// form, Close and Cancel ask first, Edit opens the job modal.

import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useState, type ReactNode } from "react";

import { useOpenJob } from "@/features/job-form/JobModalProvider";
import { useStatusAction } from "@/features/job/jobActions";

import ActionModal from "./ActionModal";
import { JOB_ACTIONS } from "./actions/registry";

type RunAction = (job: string, key: string) => void;

const ActionsContext = createContext<RunAction>(() => undefined);

export function JobActionsProvider({ children }: { children: ReactNode }) {
	const [open, setOpen] = useState<{ job: string; key: string }>();
	const openJob = useOpenJob();
	const queryClient = useQueryClient();
	const confirmStatus = useStatusAction(() => void queryClient.invalidateQueries());

	const runAction: RunAction = (job, key) => {
		if (key === "edit" || key === "tasks") openJob(job);
		else if (key === "close" || key === "cancel") confirmStatus(job, key);
		else if (JOB_ACTIONS[key]) setOpen({ job, key });
	};

	return (
		<ActionsContext.Provider value={runAction}>
			{children}
			{open && (
				<ActionModal
					key={`${open.job}-${open.key}`}
					job={open.job}
					action={open.key}
					onClose={() => setOpen(undefined)}
				/>
			)}
		</ActionsContext.Provider>
	);
}

export function useRunAction(): RunAction {
	return useContext(ActionsContext);
}
