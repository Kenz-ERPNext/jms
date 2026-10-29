// The report's filters as a row of fields, each the kind its definition says (a
// searchable Link or a list of them, a Select, a date, a tick box or text). Values go
// up on change. A filter whose doctype is another filter's value (Party after Party
// Type) is cleared when that one changes. Many tick boxes go behind an Options button.

import { ClearOutlined, SettingOutlined } from "@ant-design/icons";
import {
	Badge,
	Button,
	Checkbox,
	DatePicker,
	Flex,
	Input,
	Popover,
	Select,
	Typography,
} from "antd";
import dayjs from "dayjs";

import LinkSelect from "@/components/LinkSelect";
import { linkDoctype, selectOptions, type ReportFilter } from "@/lib/reportScript";
import { tokens } from "@/theme/tokens";

type Values = Record<string, unknown>;

/** More tick boxes than this go in the Options popover. */
const INLINE_CHECKS = 2;
/** Records of these doctypes belong to a company: list only the chosen company's. */
const BY_COMPANY = ["Account", "Cost Center"];

interface ReportFiltersProps {
	filters: ReportFilter[];
	values: Values;
	onChange: (values: Values) => void;
	/** Back to the report's own defaults; shown when a filter was changed. */
	onReset?: () => void;
}

function Field({
	f,
	values,
	set,
}: {
	f: ReportFilter;
	values: Values;
	set: (v: unknown) => void;
}) {
	const label = f.label || f.fieldname;
	const value = values[f.fieldname];
	const common = { placeholder: label, style: { width: 190 } };
	const doctype = linkDoctype(f, values);
	const company = values.company as string | undefined;
	const linkFilters =
		doctype && company && BY_COMPANY.includes(doctype)
			? [{ field: "company", operator: "eq" as const, value: company }]
			: undefined;
	const isLink = ["Link", "Dynamic Link", "MultiSelectList"].includes(f.fieldtype);
	// no doctype yet (Party before Party Type): an empty LinkSelect would query the
	// page's own resource, so show a disabled box until there is one
	if (isLink && !doctype) {
		return <Select {...common} disabled />;
	}
	switch (f.fieldtype) {
		case "Link":
		case "Dynamic Link":
			return (
				<LinkSelect
					{...common}
					key={doctype}
					doctype={doctype!}
					filters={linkFilters}
					value={value as string | undefined}
					onChange={(v) => set(v ?? undefined)}
				/>
			);
		case "MultiSelectList":
			return (
				<LinkSelect
					{...common}
					key={doctype}
					mode="multiple"
					maxTagCount="responsive"
					style={{ width: 240 }}
					doctype={doctype!}
					filters={linkFilters}
					value={(value as string[] | undefined) ?? []}
					onChange={(v: string[]) => set(v?.length ? v : undefined)}
				/>
			);
		case "Select":
		case "Autocomplete":
			return (
				<Select
					{...common}
					allowClear={!f.reqd}
					showSearch
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

/** A choice list with nothing to choose (options the script could not work out). */
const isEmptyChoice = (f: ReportFilter) =>
	(f.fieldtype === "Select" || f.fieldtype === "Autocomplete") &&
	!selectOptions(f.options).length;

export default function ReportFilters({ filters, values, onChange, onReset }: ReportFiltersProps) {
	const usable = filters.filter((f) => !isEmptyChoice(f));
	if (!usable.length) {
		return <Typography.Text type="secondary">This report has no filters.</Typography.Text>;
	}
	const set = (f: ReportFilter, v: unknown) => {
		const next = { ...values, [f.fieldname]: v };
		// filters that take their doctype from this one start again
		for (const other of usable) {
			if (other.options === f.fieldname) next[other.fieldname] = undefined;
		}
		onChange(next);
	};
	const field = (f: ReportFilter) => (
		<div key={f.fieldname} title={f.label}>
			<Field f={f} values={values} set={(v) => set(f, v)} />
		</div>
	);
	const checks = usable.filter((f) => f.fieldtype === "Check");
	const tucked = checks.length > INLINE_CHECKS ? checks : [];
	const ticked = tucked.filter((f) => values[f.fieldname]).length;

	return (
		<Flex wrap gap={tokens.space.sm} align="center">
			{usable.filter((f) => !tucked.includes(f)).map(field)}
			{tucked.length > 0 && (
				<Popover
					trigger="click"
					placement="bottomLeft"
					content={
						<Flex vertical gap={tokens.space.sm}>
							{tucked.map(field)}
						</Flex>
					}
				>
					<Badge count={ticked} size="small" color={tokens.color.primary}>
						<Button icon={<SettingOutlined />}>Options</Button>
					</Badge>
				</Popover>
			)}
			{onReset && (
				<Button type="link" icon={<ClearOutlined />} onClick={onReset}>
					Clear filters
				</Button>
			)}
		</Flex>
	);
}
