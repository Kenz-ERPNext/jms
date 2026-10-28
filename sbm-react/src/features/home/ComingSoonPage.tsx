// Stand-in for a page that is not built yet: shows its name and the plan task.

import { Card, Empty, Typography } from "antd";

import type { AppResource } from "@/config/resources";

export default function ComingSoonPage({ resource }: { resource: AppResource }) {
	return (
		<>
			<Typography.Title level={3}>{resource.label}</Typography.Title>
			<Card>
				<Empty description={`This page is coming (task ${resource.task}).`} />
			</Card>
		</>
	);
}
