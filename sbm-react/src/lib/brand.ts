// The Kenz Technology logo files (made from the logo artwork, background removed)
// and the brand gradient: the logo's navy flowing into its teal.

import { tokens } from "@/theme/tokens";

const IMAGES = "/assets/jms/images";

/** Full logo, navy and teal, for light backgrounds. */
export const LOGO = `${IMAGES}/kenz-logo.png`;
/** Full logo with white lettering, for the navy brand panel. */
export const LOGO_ON_DARK = `${IMAGES}/kenz-logo-light.png`;
/** Just the two chevrons: the collapsed sider. */
export const LOGO_MARK = `${IMAGES}/kenz-mark.png`;

export const BRAND_GRADIENT = (angle = 135) =>
	`linear-gradient(${angle}deg, ${tokens.color.primaryDark} 0%, ${tokens.color.primary} 45%, ${tokens.color.accent} 100%)`;
