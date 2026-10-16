// The frame of the login and password pages. On a laptop: one card in the middle of
// the screen, a navy-to-teal panel on the left with a slanted edge (it slides in when the
// page opens) telling what SBM does, and the form on the right. On a phone: just the
// form under the logo.

import { CheckCircleOutlined, FileDoneOutlined, LineChartOutlined } from "@ant-design/icons";
import { Flex, Grid, Typography } from "antd";
import type { ReactNode } from "react";

import { BRAND_GRADIENT, LOGO, LOGO_ON_DARK } from "@/lib/brand";
import { tokens } from "@/theme/tokens";

const { color, space, font, radius } = tokens;

const POINTS = [
	{ icon: <FileDoneOutlined />, text: "Jobs, services and tasks in one place" },
	{ icon: <CheckCircleOutlined />, text: "Invoices, payments and expenses per job" },
	{ icon: <LineChartOutlined />, text: "Profit, collections and reports at a glance" },
];
// the panel's outline: full height on the left, slanting in towards the bottom
const BLADE = (inset: number) =>
	`polygon(0 0, calc(56% - ${inset}px) 0, calc(46% - ${inset}px) 100%, 0 100%)`;

interface AuthCardProps {
	title: string;
	subtitle?: string;
	children: ReactNode;
}

function Blade() {
	return (
		<div className="sbm-blade" style={{ position: "absolute", inset: 0 }}>
			{/* a light seam along the slanted edge: the same shape a little wider */}
			<div
				style={{
					position: "absolute",
					inset: 0,
					background: color.primaryBg,
					clipPath: BLADE(0),
				}}
			/>
			<Flex
				vertical
				justify="space-between"
				style={{
					position: "absolute",
					inset: 0,
					clipPath: BLADE(4),
					padding: space.xxl + space.lg,
					color: color.surface,
					background: BRAND_GRADIENT(150),
				}}
			>
				<img
					src={LOGO_ON_DARK}
					alt="Kenz Technology"
					height={44}
					style={{ alignSelf: "flex-start" }}
				/>
				<div>
					<Typography.Title level={1} style={{ color: color.surface, margin: 0 }}>
						SBM
					</Typography.Title>
					<Typography.Text style={{ color: color.primaryBg, fontSize: font.size.lg }}>
						Service Business Management
					</Typography.Text>
					<Flex vertical gap={space.lg} style={{ marginTop: space.xxl }}>
						{POINTS.map((p) => (
							<Flex key={p.text} gap={space.md} align="center">
								<span
									style={{
										display: "grid",
										placeItems: "center",
										width: 36,
										height: 36,
										borderRadius: radius.md,
										background: "rgba(255,255,255,0.12)",
										fontSize: font.size.lg,
									}}
								>
									{p.icon}
								</span>
								<Typography.Text style={{ color: color.surface }}>
									{p.text}
								</Typography.Text>
							</Flex>
						))}
					</Flex>
				</div>
				<Typography.Text style={{ color: color.primaryBg, fontSize: font.size.sm }}>
					© {new Date().getFullYear()} Kenz Technology
				</Typography.Text>
			</Flex>
		</div>
	);
}

function Form({ title, subtitle, children, phone }: AuthCardProps & { phone?: boolean }) {
	return (
		<div style={{ width: "100%", maxWidth: 360 }}>
			{phone && (
				<Flex justify="center" style={{ marginBottom: space.xl }}>
					<img src={LOGO} alt="Kenz Technology" height={40} />
				</Flex>
			)}
			<Typography.Title level={2} style={{ margin: 0 }}>
				{title}
			</Typography.Title>
			{subtitle && (
				<Typography.Text type="secondary" style={{ fontSize: font.size.md }}>
					{subtitle}
				</Typography.Text>
			)}
			<div style={{ marginTop: space.xl }}>{children}</div>
		</div>
	);
}

export default function AuthCard(props: AuthCardProps) {
	const { lg } = Grid.useBreakpoint();
	if (!lg) {
		return (
			<Flex
				justify="center"
				style={{ minHeight: "100vh", padding: space.xl, background: color.surface }}
			>
				<Form {...props} phone />
			</Flex>
		);
	}
	return (
		<Flex
			align="center"
			justify="center"
			style={{ minHeight: "100vh", padding: space.xl, background: color.bg }}
		>
			<div
				style={{
					position: "relative",
					width: "100%",
					maxWidth: 1080,
					minHeight: 600,
					borderRadius: radius.lg * 2,
					overflow: "hidden",
					background: color.surface,
					boxShadow: "0 24px 60px rgba(26, 38, 69, 0.14)",
				}}
			>
				<Blade />
				<Flex
					align="center"
					justify="center"
					style={{ position: "absolute", inset: "0 0 0 50%", padding: space.xxl }}
				>
					<Form {...props} />
				</Flex>
			</div>
		</Flex>
	);
}
