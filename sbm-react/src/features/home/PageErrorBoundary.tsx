// Catches an error while a page renders, so one broken page shows its error
// instead of blanking the whole app (menu and header stay usable). If a newer build
// is out, the error is most likely old and new files mixing, so it reloads instead.

import { Alert, Button } from "antd";
import { Component, type ReactNode } from "react";

import { reloadIfNewBuild } from "@/lib/freshBuild";

interface State {
	error?: Error;
}

export default class PageErrorBoundary extends Component<{ children: ReactNode }, State> {
	state: State = {};

	static getDerivedStateFromError(error: Error): State {
		return { error };
	}

	componentDidCatch(error: Error) {
		console.error(error);
		void reloadIfNewBuild();
	}

	render() {
		const { error } = this.state;
		if (!error) return this.props.children;
		return (
			<Alert
				type="error"
				showIcon
				message="This page could not be shown"
				description={error.message}
				action={<Button onClick={() => window.location.reload()}>Reload</Button>}
			/>
		);
	}
}
