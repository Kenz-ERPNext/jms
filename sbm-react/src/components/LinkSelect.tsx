// Searchable dropdown of the records of a DocType, like a Link field in ERPNext.
// The value is the record's name. The label can be another field (customer_name);
// with descriptionField the list also shows that field under each option and
// searches it, while the chosen value shows only the label (a code like "101").
// The list opens when the field is reached with Tab (FocusSelect).
// With allowCreate the list ends in "+ Create a new <DocType>", as in ERPNext: a quick
// form (QuickCreate) with the typed text, and the new record is then chosen.
// The list shows 20 at first and 20 more each time it is scrolled to the bottom.

import { PlusOutlined } from "@ant-design/icons";
import { useSelect } from "@refinedev/antd";
import type { BaseRecord, CrudFilter } from "@refinedev/core";
import { Button, Divider, Typography, type SelectProps } from "antd";

import FocusSelect from "./FocusSelect";
import { useState } from "react";

import QuickCreate from "./QuickCreate";

interface LinkSelectProps extends Omit<SelectProps, "options" | "onSearch"> {
	doctype: string;
	/** Field shown as the option label and searched; default name. */
	labelField?: string;
	/** Field shown in the list under the label and also searched. */
	descriptionField?: string;
	/** Only records matching these (e.g. enabled users). */
	filters?: CrudFilter[];
	/** Offer "+ Create a new <DocType>" under the list (single choice only). */
	allowCreate?: boolean;
}

const PAGE = 20;

export default function LinkSelect({
	doctype,
	labelField = "name",
	descriptionField,
	filters,
	allowCreate,
	...rest
}: LinkSelectProps) {
	const [typed, setTyped] = useState("");
	const [creating, setCreating] = useState(false);
	const [pageSize, setPageSize] = useState(PAGE);
	const searched = [
		...new Set(["name", labelField, descriptionField].filter(Boolean)),
	] as string[];
	const { selectProps, query } = useSelect<BaseRecord>({
		resource: doctype,
		optionValue: (row) => String(row.name),
		optionLabel: (row) => String(row[labelField] || row.name),
		meta: { fields: searched },
		filters,
		pagination: { pageSize },
		queryOptions: { placeholderData: (previous) => previous },
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

	// near the bottom of the list: load the next page, while there are more
	const loaded = query.data?.data.length ?? 0;
	const onPopupScroll: SelectProps["onPopupScroll"] = (e) => {
		const el = e.currentTarget as HTMLElement;
		const more = (query.data?.total ?? 0) > loaded && loaded >= pageSize;
		if (more && !query.isFetching && el.scrollTop + el.clientHeight >= el.scrollHeight - 40)
			setPageSize((n) => n + PAGE);
	};

	const canCreate = allowCreate && !rest.mode;
	const popupRender: SelectProps["popupRender"] = canCreate
		? (menu) => (
				<>
					{menu}
					<Divider style={{ margin: "4px 0" }} />
					<Button
						type="text"
						block
						icon={<PlusOutlined />}
						style={{ textAlign: "left", justifyContent: "flex-start" }}
						// keep the focus in the select until the click is done
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => setCreating(true)}
					>
						Create a new {doctype}
					</Button>
				</>
			)
		: undefined;

	return (
		<>
			<FocusSelect
				{...selectProps}
				onSearch={(text) => (
					setTyped(text),
					setPageSize(PAGE),
					selectProps.onSearch?.(text)
				)}
				onPopupScroll={onPopupScroll}
				optionRender={optionRender}
				popupRender={popupRender}
				popupMatchSelectWidth={descriptionField || canCreate ? 280 : true}
				showSearch
				allowClear
				{...rest}
			/>
			{canCreate && (
				<QuickCreate
					doctype={doctype}
					text={typed}
					open={creating}
					onClose={() => setCreating(false)}
					onCreated={(name) => {
						void query.refetch();
						rest.onChange?.(name, { value: name, label: name });
					}}
				/>
			)}
		</>
	);
}
