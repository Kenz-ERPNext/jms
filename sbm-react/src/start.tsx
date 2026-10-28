// Starts the app. Loaded by main.tsx as its own (hashed) chunk.

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App";
import { loadBoot } from "./lib/boot";
import { reloadOnChunkError, rememberBuild } from "./lib/freshBuild";
import { applyCssVars } from "./theme/cssVars";
import "./theme/motion.css";

applyCssVars();
rememberBuild(import.meta.url);
reloadOnChunkError();

loadBoot().then(() => {
	createRoot(document.getElementById("root")!).render(
		<StrictMode>
			<App />
		</StrictMode>,
	);
});
