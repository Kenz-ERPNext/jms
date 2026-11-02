// Coloured pill for a Job status or task status, and StagePill for a work & money
// stage (shown by its plain name). Same colours everywhere.

import { Tag } from "antd";

import { stageLabel } from "@/config/stages";
import { tokens } from "@/theme/tokens";

const { color } = tokens;

const COLORS: Record<string, string> = {
	// Job status
	Created: color.textMuted,
	"In Progress": color.info,
	Processing: color.info,
	Completed: color.success,
	Closed: color.primary,
	Cancelled: color.danger,
	Canceled: color.danger,
	Rejected: color.danger,
	// Stage
	"Processing Work": color.info,
	"Invoice Pending": color.warning,
	"Amount Pending": color.warning,
	"Exp Pending": color.warning,
	// Task status
	Open: color.textMuted,
	Pending: color.warning,
};

interface PillProps {
	value?: string | null;
	/** Text to show instead of the value. */
	label?: string;
}

/** The colour of a status or stage (grey for one not known). */
export function statusColor(value?: string | null): string {
	return (value && COLORS[value]) || color.textMuted;
}

export default function StatusPill({ value, label }: PillProps) {
	if (!value) return null;
	const c = statusColor(value);
	return (
		<Tag
			bordered={false}
			style={{ color: c, background: `${c}1A`, fontWeight: 600, marginInlineEnd: 0 }}
		>
			{label ?? value}
		</Tag>
	);
}

export function StagePill({ value }: { value?: string | null }) {
	return <StatusPill value={value} label={stageLabel(value)} />;
}
