// What the quick form (QuickCreate) needs from a DocType's meta: which fields it
// shows and which one the typed text goes in.

import { request } from "@/lib/frappe";

import type { QuickField as DocField } from "./quickEntryExtras";

export interface DocMeta {
	name?: string;
	autoname?: string;
	title_field?: string;
	fields: DocField[];
}

/** Field types the quick form can show; layout fields and tables are left out. */
const SHOWN = [
	"Data",
	"Phone",
	"Select",
	"Link",
	"Date",
	"Int",
	"Float",
	"Currency",
	"Percent",
	"Check",
	"Small Text",
	"Text",
];
export const NUMBER = ["Int", "Float", "Currency", "Percent"];

export async function loadMeta(doctype: string): Promise<DocMeta> {
	const body = await request("frappe.desk.form.load.getdoctype", { doctype }, "GET");
	return (body.docs as DocMeta[])[0];
}

/** The fields of the quick form (the naming series is set by the server). */
export function quickFields(meta: DocMeta): DocField[] {
	return meta.fields.filter(
		(f) =>
			(f.reqd || f.allow_in_quick_entry) &&
			!f.hidden &&
			!f.read_only &&
			SHOWN.includes(f.fieldtype) &&
			f.fieldname !== "naming_series",
	);
}

/** The field the typed text goes in: the one the name comes from, else the title,
 * else the first text field (Employee's title is worked out, so its first name). */
export function nameField(meta: DocMeta, fields: DocField[]): string | undefined {
	const fromName = meta.autoname?.startsWith("field:") ? meta.autoname.slice(6) : undefined;
	const shown = (name?: string) => fields.some((f) => f.fieldname === name);
	if (shown(fromName)) return fromName;
	if (shown(meta.title_field)) return meta.title_field;
	return fields.find((f) => f.fieldtype === "Data")?.fieldname;
}
