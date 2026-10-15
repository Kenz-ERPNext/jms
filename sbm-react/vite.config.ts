// Dev: `yarn dev` serves http://localhost:8080/sbm/ (and /login) and proxies the Frappe API to the
// local bench (set SBM_SITE to the site name, e.g. SBM_SITE=oasis yarn dev).
// Build: one module `sbm.js` + `sbm.css` in jms/public/sbm, loaded by jms/www/sbm.html.

import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vitest/config";

const BENCH = process.env.SBM_BENCH_URL || "http://127.0.0.1:8000";
const SITE = process.env.SBM_SITE;

export default defineConfig(({ command }) => ({
	plugins: [react()],
	base: command === "build" ? "/assets/jms/sbm/" : "/",
	resolve: {
		alias: { "@": path.resolve(__dirname, "src") },
	},
	server: {
		port: 8080,
		proxy: {
			"^/(api|assets|files|private)": {
				target: BENCH,
				headers: SITE ? { Host: SITE } : undefined,
			},
		},
	},
	build: {
		outDir: "../jms/public/sbm",
		emptyOutDir: true,
		cssCodeSplit: false,
		rollupOptions: {
			input: path.resolve(__dirname, "src/main.tsx"),
			output: {
				entryFileNames: "sbm.js",
				chunkFileNames: "chunks/[name]-[hash].js",
				// Vite's preload helper would otherwise sit in sbm.js, and chunks would import
				// "../sbm.js": a second copy of the entry next to the "sbm.js?v=..." the page
				// loads, so the app would start twice (blank page).
				manualChunks: (id) => (id.includes("vite/preload-helper") ? "preload" : undefined),
				assetFileNames: (asset) =>
					asset.names?.some((name) => name.endsWith(".css"))
						? "sbm.css"
						: "assets/[name]-[hash][extname]",
			},
		},
	},
	test: {
		environment: "jsdom",
	},
}));
