// SBM design tokens: every colour, size and space the UI uses. Components get
// them through the Ant Design theme (antdTheme.ts), never as raw values.
// Colours follow the current SBM pages (green and gold); confirm with the client.

export const tokens = {
	color: {
		primary: "#166848",
		primaryBg: "#E7F3ED",
		/** Lighter green for hover and alternate rows. */
		primaryBgSoft: "#F3F9F6",
		accent: "#B8892B",
		bg: "#F7F6F2",
		surface: "#FFFFFF",
		border: "#E5E7EB",
		text: "#1F2937",
		textMuted: "#6B7280",
		success: "#16A34A",
		warning: "#D97706",
		danger: "#B42318",
		info: "#2563EB",
		/** Bars of charts: SBM green bright enough to read as a colour (passes the dataviz checks). */
		chart: "#1F8A55",
		grid: "#EEF0F2",
	},
	space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
	radius: { sm: 6, md: 8, lg: 12 },
	font: {
		family: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
		size: { sm: 12, md: 14, lg: 16, xl: 20, xxl: 24 },
	},
	layout: { headerHeight: 56, siderWidth: 232 },
	/** Hover and load animations (see motion.css). */
	motion: {
		fast: "150ms",
		slow: "600ms",
		ease: "cubic-bezier(0.2, 0, 0, 1)",
		lift: "-3px",
		shadow: "0 6px 16px rgba(22, 104, 72, 0.12)",
	},
} as const;
