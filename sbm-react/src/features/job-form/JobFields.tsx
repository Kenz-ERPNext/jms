// The job's own fields: title, customer, who pays (customer or agent), type, source.
// Three to a row on a wide screen, so the modal stays short.

import { Col, Form, Input, Row, Segmented } from "antd";

import LinkSelect from "@/components/LinkSelect";
import { tokens } from "@/theme/tokens";

const col = { xs: 24, md: 12, lg: 8 };

export default function JobFields() {
	const billTo = Form.useWatch("receivable_from");
	const required = (label: string) => [{ required: true, message: `${label} is required` }];

	return (
		<Row gutter={tokens.space.lg}>
			<Col {...col}>
				<Form.Item name="job_title" label="Job title" rules={required("Job title")}>
					<Input placeholder="e.g. Iqama renewal for 3 staff" autoFocus />
				</Form.Item>
			</Col>
			<Col {...col}>
				<Form.Item name="customer" label="Customer" rules={required("Customer")}>
					<LinkSelect
						doctype="Customer"
						labelField="customer_name"
						placeholder="Search customer"
					/>
				</Form.Item>
			</Col>
			<Col {...col}>
				<Form.Item
					name="receivable_from"
					label="Receivable from"
					rules={required("Receivable from")}
				>
					<Segmented block options={["Customer", "Agent"]} />
				</Form.Item>
			</Col>
			<Col {...col}>
				<Form.Item name="job_type" label="Job type" rules={required("Job type")}>
					<LinkSelect doctype="Job Type" placeholder="Search job type" />
				</Form.Item>
			</Col>
			<Col {...col}>
				<Form.Item name="job_source" label="Job source">
					<LinkSelect doctype="Job Source" placeholder="Walk-in, referral, ..." />
				</Form.Item>
			</Col>
			{billTo === "Agent" && (
				<Col {...col}>
					<Form.Item name="agent" label="Agent" rules={required("Agent")}>
						<LinkSelect doctype="Agent" placeholder="Search agent" />
					</Form.Item>
				</Col>
			)}
		</Row>
	);
}
