// Puts the tokens the CSS file needs (motion.css) on :root as CSS variables, so
// the CSS has no values of its own.

import { tokens } from "./tokens";

export function applyCssVars(root: HTMLElement = document.documentElement) {
	const { motion, color, radius, space } = tokens;
	const vars: Record<string, string> = {
		"--sbm-fast": motion.fast,
		"--sbm-slow": motion.slow,
		"--sbm-ease": motion.ease,
		"--sbm-lift": motion.lift,
		"--sbm-shadow": motion.shadow,
		"--sbm-hover-bg": color.primaryBgSoft,
		"--sbm-radius": `${radius.md}px`,
		"--sbm-xs": `${space.xs}px`,
		"--sbm-sm": `${space.sm}px`,
	};
	for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
}
