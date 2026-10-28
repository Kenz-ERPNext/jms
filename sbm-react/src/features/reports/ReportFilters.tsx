// The report's filters as a row of fields, each the kind its definition says (a
// searchable Link, a Select, a date, a tick box or text). Values go up on change.

import { ClearOutlined } from "@ant-design/icons";
import { Button, Checkbox, DatePicker, Flex, Input, Select, Typography } from "antd";
import dayjs from "dayjs";

import LinkSelect from "@/components/LinkSelect";
import { selectOptions, type ReportFilter } from "@/lib/reportScript";
import { tokens } from "@/theme/tokens";

type Values = Record<string, unknown>;

interface ReportFiltersProps {
	filters: ReportFilter[];
	values: Values;
	onChange: (values: Values) => void;
	/** Back to the report's own defaults; shown when a filter was changed. */
	onReset?: () => void;
}

function Field({ f, value, set }: { f: ReportFilter; value: unknown; set: (v: unknown) => void }) {
	const label = f.label || f.fieldname;
	const common = { placeholder: label, style: { width: 190 } };
	switch (f.fieldtype) {
		case "Link":
		case "Dynamic Link":
			return (
				<LinkSelect
					{...common}
					doctype={String(f.options)}
					value={value as string | undefined}
					onChange={(v) => set(v ?? undefined)}
				/>
			);
		case "Select":
			return (
				<Select
					{...common}
					allowClear={!f.reqd}
					value={(value as string) || undefined}
					options={selectOptions(f.options).map((o) => ({ value: o, label: o }))}
					onChange={(v) => set(v ?? undefined)}
				/>
			);
		case "Date":
			return (
				<DatePicker
					{...common}
					format="DD-MM-YYYY"
					value={value ? dayjs(String(value)) : null}
					onChange={(d) => set(d ? d.format("YYYY-MM-DD") : undefined)}
				/>
			);
		case "Check":
			return (
				<Checkbox
					checked={!!value}
					onChange={(e) => set(e.target.checked ? 1 : undefined)}
				>
					{label}
				</Checkbox>
			);
		default:
			return (
				<Input
					{...common}
					allowClear
					defaultValue={value as string | undefined}
					onBlur={(e) => set(e.target.value || undefined)}
					onPressEnter={(e) => set(e.currentTarget.value || undefined)}
				/>
			);
	}
}

export default function ReportFilters({ filters, values, onChange, onReset }: ReportFiltersProps) {
	if (!filters.length) {
		return <Typography.Text type="secondary">This report has no filters.</Typography.Text>;
	}
	return (
		<Flex wrap gap={tokens.space.sm} align="center">
			{filters.map((f) => (
				<div key={f.fieldname} title={f.label}>
					<Field
						f={f}
						value={values[f.fieldname]}
						set={(v) => onChange({ ...values, [f.fieldname]: v })}
					/>
				</div>
			))}
			{onReset && (
				<Button type="link" icon={<ClearOutlined />} onClick={onReset}>
					Clear filters
				</Button>
			)}
		</Flex>
	);
}
