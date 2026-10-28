// 404 and 403 pages, both with a way back home.

import { Button, Result } from "antd";
import { Link } from "react-router";

import { HOME } from "@/lib/redirect";

const goHome = (
	<Link to={HOME}>
		<Button type="primary">Go home</Button>
	</Link>
);

export default function NotFoundPage() {
	return <Result status="404" title="Page not found" extra={goHome} />;
}

export function NoAccessPage() {
	return <Result status="403" title="You do not have access to this page" extra={goHome} />;
}
