// A new record from a Link field, like ERPNext's Quick Entry: a small form with the
// DocType's mandatory fields and those marked "Allow in Quick Entry", then any extra
// ones ERPNext's form has (a customer's contact and address, quickEntryExtras.ts).
// What was typed in the search fills the name field. On save the name goes back.

import { useCreate } from "@refinedev/core";
import { useQuery } from "@tanstack/react-query";
import {
	Checkbox,
	Col,
	DatePicker,
	Divider,
	Form,
	Input,
	InputNumber,
	Modal,
	Row,
	Select,
	Skeleton,
	type FormInstance,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect } from "react";

import LinkSelect from "@/components/LinkSelect";
import { getBoot } from "@/lib/boot";

import { EXTRA_FIELDS, toServerNames, type QuickField as DocField } from "./quickEntryExtras";
import { loadMeta, nameField, NUMBER, quickFields, type DocMeta } from "./quickEntryMeta";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each control types them its own way
type FormProps = { value?: any; checked?: any; onChange?: any };

const options = (f: DocField) => (f.options ?? "").split("\n").filter(Boolean);

function startValue(f: DocField): unknown {
	if (f.fieldtype === "Date") return f.default ? dayjs() : undefined;
	if (f.fieldtype === "Check") return !!Number(f.default);
	if (f.fieldtype === "Link" && f.options === "Company") return f.default || getBoot().company;
	if (NUMBER.includes(f.fieldtype)) return f.default ? Number(f.default) : undefined;
	return f.default || undefined;
}

/** One field's control. Form.Item hands it value and onChange, passed on as `form`. */
function FieldInput({ f, focus, ...form }: { f: DocField; focus?: boolean } & FormProps) {
	switch (f.fieldtype) {
		case "Link":
			return <LinkSelect {...form} doctype={String(f.options)} placeholder={f.label} />;
		case "Select":
			return <Select {...form} options={options(f).map((o) => ({ value: o, label: o }))} />;
		case "Date":
			return <DatePicker {...form} style={{ width: "100%" }} format="DD-MM-YYYY" />;
		case "Check":
			return <Checkbox {...form}>{f.label}</Checkbox>;
		case "Small Text":
		case "Text":
			return <Input.TextArea {...form} autoSize={{ minRows: 2 }} />;
		default:
			return NUMBER.includes(f.fieldtype) ? (
				<InputNumber {...form} style={{ width: "100%" }} />
			) : (
				<Input {...form} autoFocus={focus} />
			);
	}
}

function Fields({ meta, text, form }: { meta: DocMeta; text: string; form: FormInstance }) {
	const own = quickFields(meta);
	const typedInto = nameField(meta, own);
	const fields = [...own, ...(EXTRA_FIELDS[meta.name ?? ""] ?? [])];
	useEffect(() => {
		form.setFieldsValue({
			...Object.fromEntries(fields.map((f) => [f.fieldname, startValue(f)])),
			...(typedInto && text ? { [typedInto]: text } : {}),
		});
		// once per form opening
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [meta]);
	const field = (f: DocField) => {
		if (f.fieldtype === "Section Break") {
			return (
				<Col key={f.fieldname} span={24}>
					<Divider orientation="left" plain style={{ margin: "4px 0 12px" }}>
						{f.label}
					</Divider>
				</Col>
			);
		}
		const item = (values: Record<string, unknown>) =>
			(!f.showIf || f.showIf(values)) && (
				<Col key={f.fieldname} xs={24} sm={12}>
					<Form.Item
						name={f.fieldname}
						label={f.fieldtype === "Check" ? undefined : f.label}
						valuePropName={f.fieldtype === "Check" ? "checked" : undefined}
						rules={[
							{
								required: !!f.reqd || !!f.reqdIf?.(values),
								message: `${f.label} is required`,
							},
							...(f.options === "Email" ? [{ type: "email" as const }] : []),
						]}
					>
						<FieldInput f={f} focus={f.fieldname === typedInto} />
					</Form.Item>
				</Col>
			);
		// conditional fields follow the rest of the form
		return f.showIf || f.reqdIf ? (
			<Form.Item key={f.fieldname} noStyle shouldUpdate>
				{() => item(form.getFieldsValue(true))}
			</Form.Item>
		) : (
			item({})
		);
	};
	return <Row gutter={16}>{fields.map(field)}</Row>;
}

export default function QuickCreate({
	doctype,
	text,
	open,
	onClose,
	onCreated,
}: {
	doctype: string;
	/** What was typed in the search: the new record's name. */
	text: string;
	open: boolean;
	onClose: () => void;
	onCreated: (name: string) => void;
}) {
	const [form] = Form.useForm();
	const meta = useQuery({
		queryKey: ["doctype-meta", doctype],
		queryFn: () => loadMeta(doctype),
		enabled: open,
		staleTime: Infinity,
	});
	const { mutateAsync, mutation } = useCreate();

	const save = async () => {
		const values = await form.validateFields();
		const doc = Object.fromEntries(
			Object.entries(values).map(([k, v]) => [
				k,
				dayjs.isDayjs(v)
					? (v as Dayjs).format("YYYY-MM-DD")
					: typeof v === "boolean"
						? +v
						: v,
			]),
		);
		const res = await mutateAsync({
			resource: doctype,
			values: toServerNames(doc),
			successNotification: { type: "success", message: `${doctype} created` },
			errorNotification: (error) => ({
				type: "error",
				message: `Could not create the ${doctype}`,
				description: error?.message,
			}),
		});
		onCreated(String(res.data.name));
		onClose();
	};

	return (
		<Modal
			open={open}
			title={`New ${doctype}`}
			okText="Save"
			onOk={save}
			confirmLoading={mutation.isPending}
			onCancel={onClose}
			destroyOnHidden
			width={EXTRA_FIELDS[doctype] ? 640 : 480}
		>
			{meta.data ? (
				<Form form={form} layout="vertical" preserve={false} onFinish={save}>
					<Fields meta={meta.data} text={text} form={form} />
				</Form>
			) : (
				<Skeleton active />
			)}
		</Modal>
	);
}
