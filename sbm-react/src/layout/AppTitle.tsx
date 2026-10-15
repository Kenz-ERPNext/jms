// Logo and app name at the top of the sider (just the logo when collapsed).

import { Flex, Typography } from "antd";
import { Link } from "react-router";

import { HOME } from "@/lib/redirect";
import { tokens } from "@/theme/tokens";

const LOGO = "/assets/jms/images/oasis-cienteirs-logo.png";

export default function AppTitle({ collapsed }: { collapsed: boolean }) {
	return (
		<Link to={HOME}>
			<Flex align="center" gap={tokens.space.sm}>
				<img src={LOGO} alt="" height={36} />
				{!collapsed && (
					<Typography.Text
						strong
						style={{ color: tokens.color.primary, fontSize: tokens.font.size.lg }}
					>
						SBM
					</Typography.Text>
				)}
			</Flex>
		</Link>
	);
}
