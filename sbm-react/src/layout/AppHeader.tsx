// Top bar: the user menu (Open ERPNext, Logout) on the right.

import { DownOutlined, ExportOutlined, LogoutOutlined } from "@ant-design/icons";
import { useLogout } from "@refinedev/core";
import { Avatar, Dropdown, Flex, Layout, Typography, type MenuProps } from "antd";

import { getBoot } from "@/lib/boot";
import { ADMIN_ROLES, hasAnyRole } from "@/lib/roles";
import { tokens } from "@/theme/tokens";

export default function AppHeader() {
	const boot = getBoot();
	const { mutate: logout } = useLogout();
	const name = boot.full_name || boot.user;

	const items: MenuProps["items"] = [
		// Desk roles may still open ERPNext; everyone else works only in SBM.
		...(hasAnyRole(ADMIN_ROLES)
			? [{ key: "desk", icon: <ExportOutlined />, label: <a href="/app">Open ERPNext</a> }]
			: []),
		{ key: "logout", icon: <LogoutOutlined />, label: "Logout", onClick: () => logout() },
	];

	return (
		<Layout.Header
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
				borderBottom: `1px solid ${tokens.color.border}`,
				position: "sticky",
				top: 0,
				zIndex: 10,
			}}
		>
			{/* keeps the user menu on the right */}
			<div />
			<Dropdown menu={{ items }} trigger={["click"]} placement="bottomRight">
				<Flex align="center" gap={tokens.space.sm} style={{ cursor: "pointer" }}>
					<Avatar style={{ background: tokens.color.accent }}>{initials(name)}</Avatar>
					<Typography.Text>{name}</Typography.Text>
					<DownOutlined
						style={{ fontSize: tokens.font.size.sm, color: tokens.color.textMuted }}
					/>
				</Flex>
			</Dropdown>
		</Layout.Header>
	);
}

function initials(name: string): string {
	const parts = name.split(/\s+/).filter(Boolean);
	return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}
