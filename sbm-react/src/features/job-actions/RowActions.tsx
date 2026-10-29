// Icon buttons for one job in a list, each in its own colour: Create (the ERPNext
// Create menu: the actions the server allows for this job, loaded on hover, grouped
// and coloured by kind: customer, outsourcing, expense), Edit,
// Print, Close and Cancel. Close and Cancel follow the ERPNext rules on the status.

import {
	CheckCircleOutlined,
	CloseCircleOutlined,
	EditOutlined,
	PlusCircleOutlined,
	PrinterOutlined,
} from "@ant-design/icons";
import { useCustom } from "@refinedev/core";
import { Button, Dropdown, Space, Tooltip } from "antd";
import { useState, type ReactNode } from "react";

import { createMenuItems } from "@/features/job/jobActions";
import type { JobState } from "@/features/job/useJob";
import { openPrint } from "@/lib/links";

import { tokens } from "@/theme/tokens";

import { useRunAction } from "./JobActionsProvider";

const LOCKED = ["Closed", "Cancelled", "Rejected"];

const { color } = tokens;
const COLOR = {
	create: color.primary,
	edit: color.info,
	print: color.accent,
	close: color.success,
	cancel: color.danger,
};

function IconButton(props: {
	title: string;
	icon: ReactNode;
	onClick?: () => void;
	color: string;
	onMouseEnter?: () => void;
}) {
	return (
		<Tooltip title={props.title}>
			<Button
				size="small"
				type="text"
				aria-label={props.title}
				icon={props.icon}
				style={{ color: props.color }}
				onMouseEnter={props.onMouseEnter}
				onFocus={props.onMouseEnter}
				onClick={props.onClick}
			/>
		</Tooltip>
	);
}

export default function RowActions({ job, status }: { job: string; status: string }) {
	const [open, setOpen] = useState(false);
	// fetched on hover, so the menu is usually ready before the click
	const [wanted, setWanted] = useState(false);
	const runAction = useRunAction();
	const { query } = useCustom<JobState>({
		url: "jms.api.job_state.get_job_state",
		method: "get",
		config: { query: { job } },
		queryOptions: { enabled: open || wanted, staleTime: 30_000 },
	});
	const createItems = createMenuItems((query.data?.data?.actions ?? []).map((a) => a.key));

	return (
		// a click here must not also open the row
		<span onClick={(e) => e.stopPropagation()}>
			<Space size={2}>
				<Dropdown
					trigger={["click"]}
					open={open}
					onOpenChange={setOpen}
					// fixed width and right edge: the menu does not jump when the actions arrive
					placement="bottomRight"
					overlayStyle={{ minWidth: 230 }}
					menu={{
						items: query.isFetching
							? [{ key: "loading", label: "Loading…", disabled: true }]
							: createItems,
						onClick: ({ key }) => (setOpen(false), runAction(job, key)),
					}}
				>
					{/* a span keeps the tooltip and the menu on the same button */}
					<span>
						<IconButton
							title="Create"
							icon={<PlusCircleOutlined />}
							color={COLOR.create}
							onMouseEnter={() => setWanted(true)}
						/>
					</span>
				</Dropdown>
				<IconButton
					title="Edit"
					icon={<EditOutlined />}
					color={COLOR.edit}
					onClick={() => runAction(job, "edit")}
				/>
				<IconButton
					title="Print"
					icon={<PrinterOutlined />}
					color={COLOR.print}
					onClick={() => openPrint(job)}
				/>
				{!LOCKED.includes(status) && (
					<IconButton
						title="Close Job"
						icon={<CheckCircleOutlined />}
						color={COLOR.close}
						onClick={() => runAction(job, "close")}
					/>
				)}
				{![...LOCKED, "Completed"].includes(status) && (
					<IconButton
						title="Cancel"
						icon={<CloseCircleOutlined />}
						color={COLOR.cancel}
						onClick={() => runAction(job, "cancel")}
					/>
				)}
			</Space>
		</span>
	);
}
