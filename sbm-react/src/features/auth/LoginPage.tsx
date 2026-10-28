// SBM login page, shown at /login (the server replaces the ERPNext login with it).
// Frappe checks the password; on success the page reloads into the app (or ?redirect-to / ?to).

import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { useLogin } from "@refinedev/core";
import { Button, Form, Input } from "antd";
import { Navigate, useLocation } from "react-router";

import { BRAND_GRADIENT } from "@/lib/brand";
import { HOME } from "@/lib/redirect";
import { tokens } from "@/theme/tokens";

import AuthCard from "./AuthCard";

interface LoginForm {
	email: string;
	password: string;
}

export default function LoginPage() {
	// A failed login is shown by Refine as an error notification.
	const { mutate: login, isPending } = useLogin<LoginForm>();

	// ERPNext links to /login#forgot for a lost password
	if (useLocation().hash === "#forgot")
		return <Navigate to={`${HOME}/forgot-password`} replace />;

	return (
		<AuthCard title="Welcome back" subtitle="Log in to continue to SBM">
			<Form<LoginForm>
				layout="vertical"
				requiredMark={false}
				onFinish={(values) => login(values)}
			>
				<Form.Item
					name="email"
					label="Email or username"
					rules={[{ required: true, message: "Enter your email" }]}
				>
					<Input
						prefix={<UserOutlined />}
						size="large"
						autoComplete="username"
						autoFocus
					/>
				</Form.Item>
				<Form.Item
					name="password"
					label="Password"
					style={{ marginBottom: tokens.space.xl }}
					rules={[{ required: true, message: "Enter your password" }]}
				>
					<Input.Password
						prefix={<LockOutlined />}
						size="large"
						autoComplete="current-password"
					/>
				</Form.Item>
				{/* "Forgot password?" comes back here once its page gets this design */}
				<Button
					type="primary"
					htmlType="submit"
					size="large"
					block
					loading={isPending}
					// the brand gradient, like the panel beside the form
					style={{ background: BRAND_GRADIENT(90), border: "none" }}
				>
					Log in
				</Button>
			</Form>
		</AuthCard>
	);
}
