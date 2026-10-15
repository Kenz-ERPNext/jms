// Catches an error while a page renders, so one broken page shows its error
// instead of blanking the whole app (menu and header stay usable).

import { Alert, Button } from "antd";
import { Component, type ReactNode } from "react";

interface State {
	error?: Error;
}

export default class PageErrorBoundary extends Component<{ children: ReactNode }, State> {
	state: State = {};

	static getDerivedStateFromError(error: Error): State {
		return { error };
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
