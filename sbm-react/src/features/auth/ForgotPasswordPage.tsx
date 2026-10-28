// Forgot password (/sbm/forgot-password). Frappe emails a reset link; the same
// message is shown whether or not the email exists.

import { MailOutlined } from "@ant-design/icons";
import { useForgotPassword } from "@refinedev/core";
import { Alert, Button, Form, Input } from "antd";
import { Link } from "react-router";

import { LOGIN } from "@/lib/redirect";
import { RESET_SENT } from "@/providers/authProvider";

import AuthCard from "./AuthCard";

interface ForgotForm {
	email: string;
}

export default function ForgotPasswordPage() {
	const { mutate: sendLink, isPending, data } = useForgotPassword<ForgotForm>();
	// Success replaces the form with a message; an error is a Refine notification.
	const sent = data?.success === true;

	return (
		<AuthCard
			title="Forgot password"
			subtitle="We will email you a link to set a new password"
		>
			{sent && (
				<Alert type="success" showIcon message={RESET_SENT} style={{ marginBottom: 16 }} />
			)}
			{!sent && (
				<Form<ForgotForm>
					layout="vertical"
					requiredMark={false}
					onFinish={(values) => sendLink(values)}
				>
					<Form.Item
						name="email"
						label="Email"
						rules={[{ required: true, type: "email", message: "Enter a valid email" }]}
					>
						<Input
							prefix={<MailOutlined />}
							size="large"
							autoComplete="email"
							autoFocus
						/>
					</Form.Item>
					<Button
						type="primary"
						htmlType="submit"
						size="large"
						block
						loading={isPending}
					>
						Send reset link
					</Button>
				</Form>
			)}
			<div style={{ marginTop: 16, textAlign: "center" }}>
				<Link to={LOGIN}>Back to login</Link>
			</div>
		</AuthCard>
	);
}
