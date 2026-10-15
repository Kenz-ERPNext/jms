// Centered card with the logo, shared by the login and password pages.

import { Card, Flex, Typography, theme } from "antd";
import type { ReactNode } from "react";

const LOGO = "/assets/jms/images/oasis-cienteirs-logo.png";

interface AuthCardProps {
	title: string;
	subtitle?: string;
	children: ReactNode;
}

export default function AuthCard({ title, subtitle, children }: AuthCardProps) {
	const { token } = theme.useToken();
	return (
		<Flex
			align="center"
			justify="center"
			style={{ minHeight: "100vh", padding: token.padding, background: token.colorBgLayout }}
		>
			<Card
				style={{ width: "100%", maxWidth: 400 }}
				styles={{ body: { padding: token.paddingXL } }}
			>
				<Flex
					vertical
					align="center"
					gap={token.marginXS}
					style={{ marginBottom: token.marginLG }}
				>
					<img src={LOGO} alt="" height={56} />
					<Typography.Title level={3} style={{ margin: 0 }}>
						{title}
					</Typography.Title>
					{subtitle && <Typography.Text type="secondary">{subtitle}</Typography.Text>}
				</Flex>
				{children}
			</Card>
		</Flex>
	);
}
