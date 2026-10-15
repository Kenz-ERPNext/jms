// Searchable dropdown of the records of a DocType, like a Link field in ERPNext.
// The value is the record's name. The label can be another field (customer_name);
// with descriptionField the list also shows that field under each option and
// searches it, while the chosen value shows only the label (a code like "101").

import { useSelect } from "@refinedev/antd";
import type { BaseRecord, CrudFilter } from "@refinedev/core";
import { Select, Typography, type SelectProps } from "antd";

interface LinkSelectProps extends Omit<SelectProps, "options" | "onSearch"> {
	doctype: string;
	/** Field shown as the option label and searched; default name. */
	labelField?: string;
	/** Field shown in the list under the label and also searched. */
	descriptionField?: string;
}

export default function LinkSelect({
	doctype,
	labelField = "name",
	descriptionField,
	...rest
}: LinkSelectProps) {
	const searched = [
		...new Set(["name", labelField, descriptionField].filter(Boolean)),
	] as string[];
	const { selectProps, query } = useSelect<BaseRecord>({
		resource: doctype,
		optionValue: (row) => String(row.name),
		optionLabel: (row) => String(row[labelField] || row.name),
		meta: { fields: searched },
		pagination: { pageSize: 20 },
		debounce: 300,
		defaultValue: rest.value ?? undefined,
		onSearch: (text): CrudFilter[] =>
			text
				? [
						{
							operator: "or",
							value: searched.map((field) => ({
								field,
								operator: "contains",
								value: text,
							})),
						},
					]
				: [],
	});

	const description = new Map(
		(query.data?.data ?? []).map((row) => [String(row.name), row[descriptionField ?? ""]]),
	);
	const optionRender: SelectProps["optionRender"] = descriptionField
		? (option) => (
				<div>
					<strong>{option.label}</strong>
					<Typography.Text type="secondary" style={{ display: "block" }}>
						{description.get(String(option.value))}
					</Typography.Text>
				</div>
			)
		: undefined;

	return (
		<Select
			{...selectProps}
			optionRender={optionRender}
			popupMatchSelectWidth={descriptionField ? 280 : true}
			showSearch
			allowClear
			{...rest}
		/>
	);
}
