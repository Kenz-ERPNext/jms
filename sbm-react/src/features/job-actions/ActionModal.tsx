// The modal around one job action form: loads the job, shows the form, saves
// through the Job method and shows the server's message if it fails. To amend a
// cancelled document, the form starts from its values and saves as its amendment.

import { useOne } from "@refinedev/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Alert, App, Form, Grid, Modal, Skeleton, Typography } from "antd";
import { useState } from "react";

import { tokens } from "@/theme/tokens";

import { JOB_ACTIONS } from "./actions/registry";
import type { ActionJob, AmendOf, Values } from "./types";

interface ActionModalProps {
	job: string;
	action: string;
	onClose: () => void;
	/** Amend this cancelled document, starting from these values. */
	amend?: AmendOf & { values: Values };
}

export default function ActionModal({ job: name, action, onClose, amend }: ActionModalProps) {
	const config = JOB_ACTIONS[action];
	const [form] = Form.useForm();
	const [error, setError] = useState<string>();
	const [saving, setSaving] = useState(false);
	const { message } = App.useApp();
	// three fields to a row on a wide screen, so the form needs no scrolling
	const { md } = Grid.useBreakpoint();
	const columns = md ? 3 : 1;
	const queryClient = useQueryClient();
	const { query } = useOne<ActionJob>({ resource: "Job", id: name });
	const job = query.data?.data;
	// as ERPNext: some actions answer with a message instead of the form
	const { data: blocked, isLoading: checking } = useQuery({
		queryKey: ["action-blocked", name, action],
		queryFn: () => config.blocked?.(job!) ?? Promise.resolve(undefined),
		enabled: !!job,
		select: (reason) => reason ?? null,
	});

	const save = async () => {
		setError(undefined);
		const values = await form.validateFields().catch(() => null);
		if (!values || !job) return;
		setSaving(true);
		try {
			const made = await config.submit(
				job,
				values,
				amend && { doctype: amend.doctype, name: amend.name },
			);
			message.success(made.length ? `Saved: ${made.join(", ")}` : "Saved");
			// lists, dashboard and money figures all change
			await queryClient.invalidateQueries();
			onClose();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not save");
		} finally {
			setSaving(false);
		}
	};

	return (
		<Modal
			open
			title={amend ? `Amend ${amend.name} · ${name}` : `${config.title} · ${name}`}
			okText={config.okText}
			okButtonProps={{ disabled: !!blocked || checking }}
			onOk={save}
			confirmLoading={saving}
			onCancel={onClose}
			destroyOnHidden
			width={md ? 940 : undefined}
		>
			<Typography.Paragraph type="secondary">
				{amend
					? `Filled in from the cancelled ${amend.name}. Change what was wrong and save: the new ${amend.doctype} is its amendment.`
					: config.hint}
			</Typography.Paragraph>
			{error && (
				<Alert
					type="error"
					showIcon
					message={error}
					style={{ marginBottom: tokens.space.md }}
				/>
			)}
			{blocked ? (
				<Alert type="warning" showIcon message={blocked} />
			) : !job || checking ? (
				<Skeleton active />
			) : (
				<Form
					form={form}
					layout="vertical"
					initialValues={{ ...config.initialValues?.(job), ...amend?.values }}
					disabled={saving}
					style={{
						display: "grid",
						gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
						columnGap: tokens.space.lg,
					}}
				>
					<config.Fields job={job} />
				</Form>
			)}
		</Modal>
	);
}
