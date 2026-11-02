// Colours of the job cards (JobCard): each stage and status, priorities and customer avatars.

import { tokens } from "@/theme/tokens";

const { color } = tokens;

export const PRIORITY_COLORS: Record<string, string> = {
	Urgent: color.danger,
	High: color.danger,
	Medium: color.warning,
	Low: color.info,
};
// one colour for each stage and status, like the desk Job Portal (6-digit hex: tints add alpha)
export const CARD_COLORS: Record<string, string> = {
	Created: "#3498DB",
	"Processing Work": "#F39C12",
	"Invoice Pending": "#17A2B8",
	"Amount Pending": "#D4AC0D",
	"Exp Pending": "#E83E8C",
	Completed: "#2ECC71",
	Closed: "#9B59B6",
	Cancelled: "#E74C3C",
	Canceled: "#E74C3C",
	Rejected: "#E74C3C",
};
// avatar colours: the same customer always gets the same one
const AVATAR_COLORS = [color.primary, color.chart, color.info, color.purple, color.warning];

export function avatarColor(name: string): string {
	let sum = 0;
	for (const ch of name) sum += ch.charCodeAt(0);
	return AVATAR_COLORS[sum % AVATAR_COLORS.length];
}

export function initials(name: string): string {
	const words = name.trim().split(/\s+/);
	return (
		(words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1][0] : "")
	).toUpperCase();
}
