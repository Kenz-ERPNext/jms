// One modal for a new job and for an existing one: the job's fields, its services
// and its tasks. Saving closes it and shows a short message with the job number.
// The header and the buttons stay in view; only the form scrolls, inside the modal.

import {
	Alert,
	App,
	Button,
	ConfigProvider,
	Divider,
	Flex,
	Form,
	Modal,
	Skeleton,
	Space,
	Tabs,
	Typography,
} from "antd";
import { useEffect } from "react";

import { PrinterOutlined } from "@ant-design/icons";

import StatusPill from "@/components/StatusPill";
import { openPrint } from "@/lib/links";
import { tokens } from "@/theme/tokens";

import LinkedDocuments from "@/features/job/tabs/LinkedDocuments";

import JobFields from "./JobFields";
import ServicesTable from "./ServicesTable";
import TasksTable from "./TasksTable";
import type { JobFormValues } from "./types";
import { useJobForm } from "./useJobForm";

interface JobModalProps {
	name?: string;
	open: boolean;
	onClose: () => void;
	/** After a new job is saved: show it in the modal. */
}

// Room left for the modal title, buttons and page margin.
const BODY = {
	maxHeight: `calc(100vh - ${tokens.space.xxl * 6}px)`,
	overflowY: "auto" as const,
	paddingRight: tokens.space.sm,
};
const DIVIDER = { margin: `${tokens.space.md}px 0` };
// Less space between fields than a normal form, so more fits without scrolling.
const COMPACT = {
	components: {
		Form: {
			itemMarginBottom: tokens.space.md,
			verticalLabelPadding: `0 0 ${tokens.space.xs}px`,
		},
	},
};

const NEW_JOB: JobFormValues = { receivable_from: "Customer", items: [{ job_qty: 1 }], tasks: [] };

export default function JobModal({ name, open, onClose }: JobModalProps) {
	const [form] = Form.useForm<JobFormValues>();
	const { message } = App.useApp();
	const { job, isLoading, error, isSaving, save } = useJobForm(name);

	useEffect(() => {
		if (!open) return;
		form.resetFields();
		form.setFieldsValue(name ? (job ?? {}) : NEW_JOB);
	}, [open, name, job, form]);

	const submit = async (values: JobFormValues) => {
		try {
			const saved = await save(values);
			message.success(name ? `${saved} saved` : `Job ${saved} created`);
			onClose();
		} catch {
			// Refine shows the server's message as a notification
		}
	};

	const title = name ? (
		<Space wrap>
			<span>{name}</span>
			{job && <StatusPill value={job.status} />}
			<Button size="small" icon={<PrinterOutlined />} onClick={() => openPrint(name)}>
				Print
			</Button>
		</Space>
	) : (
		"New job"
	);

	const details = (
		<ConfigProvider theme={COMPACT}>
			<Form form={form} layout="vertical" requiredMark onFinish={submit} disabled={isSaving}>
				<JobFields />
				<Divider orientation="left" plain style={DIVIDER}>
					<Typography.Text strong>Services</Typography.Text>
				</Divider>
				<ServicesTable />
				<Divider orientation="left" plain style={DIVIDER}>
					<Typography.Text strong>Tasks</Typography.Text>
				</Divider>
				<TasksTable isNew={!name} />
			</Form>
		</ConfigProvider>
	);

	return (
		<Modal
			open={open}
			title={title}
			onCancel={onClose}
			width={1100}
			style={{ top: tokens.space.xl }}
			styles={{ body: BODY }}
			destroyOnHidden
			footer={
				<Flex justify="end" gap={tokens.space.sm}>
					<Button onClick={onClose}>Cancel</Button>
					<Button type="primary" loading={isSaving} onClick={() => form.submit()}>
						{name ? "Save" : "Create job"}
					</Button>
				</Flex>
			}
		>
			{error && (
				<Alert
					type="error"
					showIcon
					message="Could not open the job"
					description={error.message}
				/>
			)}
			{isLoading ? (
				<Skeleton active paragraph={{ rows: 10 }} />
			) : (
				<Tabs
					items={[
						{ key: "details", label: "Details", children: details },
						// an existing job also shows its invoices and payments
						...(name
							? [
									{
										key: "connections",
										label: "Connections",
										children: <LinkedDocuments name={name} />,
									},
								]
							: []),
					]}
				/>
			)}
		</Modal>
	);
}
