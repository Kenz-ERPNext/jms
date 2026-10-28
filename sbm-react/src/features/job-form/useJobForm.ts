// Load and save a Job for the modal. Saving an existing job sends every table row
// in full: Frappe replaces a child row with what it gets, so fields the modal does
// not show (purchase_invoice, due_date, ...) are copied from the loaded row.

import { useCreate, useOne, useUpdate } from "@refinedev/core";
import { useQueryClient } from "@tanstack/react-query";

import { getBoot } from "@/lib/boot";

import type { JobFormValues, ServiceRow, TaskRow } from "./types";

type Loaded = JobFormValues & { name: string; status: string };

/** A cleared field is undefined, which JSON leaves out and the server then keeps;
 * send null so it is cleared. */
export function withNulls<T extends object>(values: T): T {
	return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v ?? null])) as T;
}

/** Edited rows on top of the loaded rows with the same name; new rows as they are. */
export function mergeRows<T extends { name?: string }>(edited: T[] = [], original: T[] = []): T[] {
	const byName = new Map(original.map((row) => [row.name, row]));
	return edited.map((row) => {
		const changes = withNulls(row);
		return row.name ? { ...byName.get(row.name), ...changes } : changes;
	});
}

export function useJobForm(name?: string) {
	const { query } = useOne<Loaded>({
		resource: "Job",
		id: name ?? "",
		queryOptions: { enabled: !!name },
	});
	const { mutateAsync: create, mutation: creating } = useCreate();
	const { mutateAsync: update, mutation: updating } = useUpdate();
	const queryClient = useQueryClient();
	const job = name ? query.data?.data : undefined;

	const save = async (values: JobFormValues): Promise<string> => {
		const data = {
			...withNulls(values),
			items: mergeRows<ServiceRow>(values.items, job?.items),
			tasks: mergeRows<TaskRow>(values.tasks, job?.tasks),
		};
		const saved = name
			? await update({ resource: "Job", id: name, values: data, successNotification: false })
			: await create({
					resource: "Job",
					values: { ...data, company: getBoot().company },
					successNotification: false,
				});
		// lists, dashboard and the job page show fresh numbers
		await queryClient.invalidateQueries();
		return String(saved.data.name ?? saved.data.id);
	};

	return {
		job,
		isLoading: !!name && query.isLoading,
		error: query.error,
		isSaving: creating.isPending || updating.isPending,
		save,
		refetch: query.refetch,
	};
}
