// SBM login page, shown at /login (the server replaces the ERPNext login with it).
// Frappe checks the password; on success the page reloads into the app (or ?redirect-to / ?to).

import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { useLogin } from "@refinedev/core";
import { Button, Form, Input } from "antd";
import { Link, Navigate, useLocation } from "react-router";

import { HOME } from "@/lib/redirect";

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
		<AuthCard title="Log in" subtitle="Service Business Management">
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
					rules={[{ required: true, message: "Enter your password" }]}
				>
					<Input.Password
						prefix={<LockOutlined />}
						size="large"
						autoComplete="current-password"
					/>
				</Form.Item>
				<Button type="primary" htmlType="submit" size="large" block loading={isPending}>
					Log in
				</Button>
			</Form>
			<div style={{ marginTop: 16, textAlign: "center" }}>
				<Link to={`${HOME}/forgot-password`}>Forgot password?</Link>
			</div>
		</AuthCard>
	);
}
