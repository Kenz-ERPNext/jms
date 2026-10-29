// Design tokens → Ant Design theme (used by ConfigProvider in App.tsx).

import type { ThemeConfig } from "antd";

import { tokens } from "./tokens";

const { color, radius, font, layout } = tokens;

/** Form fields: a thin soft border on hover and focus, no glow around it. */
const FIELD = {
	hoverBorderColor: color.borderFocus,
	activeBorderColor: color.borderFocus,
	activeShadow: "none",
};

export const antdTheme: ThemeConfig = {
	token: {
		colorPrimary: color.primary,
		colorSuccess: color.success,
		colorWarning: color.warning,
		colorError: color.danger,
		colorInfo: color.info,
		colorLink: color.primary,
		colorText: color.text,
		colorTextSecondary: color.textMuted,
		colorBorder: color.border,
		colorBgLayout: color.bg,
		colorBgContainer: color.surface,
		borderRadius: radius.md,
		fontFamily: font.family,
		fontSize: font.size.md,
	},
	components: {
		Select: { ...FIELD, activeOutlineColor: "transparent" },
		Input: FIELD,
		InputNumber: FIELD,
		DatePicker: FIELD,
		Layout: {
			headerBg: color.surface,
			headerHeight: layout.headerHeight,
			headerPadding: `0 ${tokens.space.xl}px`,
			siderBg: color.surface,
			bodyBg: color.bg,
		},
		// Every table: tinted header in the main colour, light hover, compact rows.
		Table: {
			headerBg: color.primaryBg,
			headerColor: color.primary,
			headerSplitColor: "transparent",
			headerBorderRadius: radius.md,
			rowHoverBg: color.primaryBgSoft,
			rowSelectedBg: color.primaryBg,
			borderColor: color.border,
			cellPaddingBlock: tokens.space.md,
			cellPaddingBlockMD: tokens.space.sm,
			cellPaddingBlockSM: tokens.space.xs,
		},
		Pagination: {
			itemActiveBg: color.primary,
			itemActiveColor: color.surface,
			itemActiveColorHover: color.surface,
		},
		Tabs: {
			itemSelectedColor: color.primary,
			inkBarColor: color.primary,
			itemHoverColor: color.primary,
		},
		Menu: {
			itemSelectedBg: color.primaryBg,
			itemSelectedColor: color.primary,
			itemHoverBg: color.bg,
			subMenuItemBg: color.surface,
		},
	},
};
