// Lint rules for the SBM frontend. max-lines keeps every file at 200 lines or less.

import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
	{ ignores: ["node_modules"] },
	{
		files: ["**/*.{ts,tsx}"],
		extends: [js.configs.recommended, tseslint.configs.recommended],
		languageOptions: { globals: globals.browser },
		plugins: { "react-hooks": reactHooks },
		rules: {
			...reactHooks.configs.recommended.rules,
			"max-lines": ["error", { max: 200, skipBlankLines: true, skipComments: true }],
		},
	},
]);
