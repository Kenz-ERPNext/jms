// Reading any document for the read-only viewer: its meta and values, laid out as the
// form's sections (fields with a value, child tables with their list columns).

import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { fromHtml } from "@/lib/html";
import { request } from "@/lib/frappe";

export interface DocField {
	fieldname: string;
	label?: string;
	fieldtype: string;
	options?: string;
	hidden?: 0 | 1;
	in_list_view?: 0 | 1;
}

export interface DocMeta {
	name: string;
	is_submittable?: 0 | 1;
	title_field?: string;
	fields: DocField[];
}

export type Doc = Record<string, unknown> & { name: string; docstatus?: number };

export interface Section {
	label: string;
	fields: { field: DocField; value: unknown }[];
	tables: { field: DocField; columns: DocField[]; rows: Doc[] }[];
}

const LAYOUT = ["Section Break", "Column Break", "Tab Break", "Fold"];
const SKIP = [...LAYOUT, "Button", "HTML", "Image", "Heading", "Password", "Signature"];
const TABLE = ["Table", "Table MultiSelect"];
export const NUMBER = ["Currency", "Float", "Int", "Percent"];

/** The document and the metas of it and its child tables. */
export async function loadDoc(
	doctype: string,
	name: string,
): Promise<{ doc: Doc; metas: Record<string, DocMeta> }> {
	const [docBody, metaBody] = await Promise.all([
		request("frappe.desk.form.load.getdoc", { doctype, name }, "GET"),
		request("frappe.desk.form.load.getdoctype", { doctype }, "GET"),
	]);
	const doc = (docBody.docs as Doc[])[0];
	const metas = Object.fromEntries((metaBody.docs as DocMeta[]).map((m) => [m.name, m]));
	return { doc, metas };
}

export function hasValue(value: unknown, field: DocField): boolean {
	if (value === null || value === undefined || value === "") return false;
	if (NUMBER.includes(field.fieldtype) || field.fieldtype === "Check")
		return Number(value) !== 0;
	if (Array.isArray(value)) return value.length > 0;
	return true;
}

/** The form's sections, with only the fields that have a value; empty sections left out. */
export function toSections(meta: DocMeta, doc: Doc, metas: Record<string, DocMeta>): Section[] {
	const sections: Section[] = [{ label: "", fields: [], tables: [] }];
	for (const f of meta.fields) {
		if (f.fieldtype === "Section Break" || f.fieldtype === "Tab Break") {
			sections.push({ label: f.label ?? "", fields: [], tables: [] });
			continue;
		}
		if (f.hidden || SKIP.includes(f.fieldtype) || !hasValue(doc[f.fieldname], f)) continue;
		const section = sections[sections.length - 1];
		if (TABLE.includes(f.fieldtype)) {
			const child = f.options ? metas[f.options] : undefined;
			const rows = doc[f.fieldname] as Doc[];
			const columns = (child?.fields ?? []).filter(
				(c) =>
					c.in_list_view &&
					!c.hidden &&
					!SKIP.includes(c.fieldtype) &&
					rows.some((r) => hasValue(r[c.fieldname], c)),
			);
			section.tables.push({ field: f, columns, rows });
		} else {
			section.fields.push({ field: f, value: doc[f.fieldname] });
		}
	}
	return sections.filter((s) => s.fields.length || s.tables.length);
}

/** A value as text, by field type. Money is in the document's currency when it has one. */
export function display(value: unknown, field: DocField, doc?: Doc): string {
	if (!hasValue(value, field)) return "";
	switch (field.fieldtype) {
		case "Currency": {
			const cur = currencyOf(field, doc);
			return formatMoney(Number(value), cur);
		}
		case "Float":
		case "Int":
			return Number(value).toLocaleString();
		case "Percent":
			return `${Number(value).toLocaleString()}%`;
		case "Date":
			return formatDate(String(value));
		case "Datetime":
			return formatDateTime(String(value));
		case "Check":
			return "Yes";
		case "Table MultiSelect":
			return (value as Doc[])
				.map((r) => Object.values(r).find((v) => typeof v === "string" && v !== r.name))
				.join(", ");
		default:
			return fromHtml(String(value)).text;
	}
}

/** A Currency field's options name the field holding its currency ("currency"). */
function currencyOf(field: DocField, doc?: Doc): string | undefined {
	const v = field.options && doc ? doc[field.options] : undefined;
	return typeof v === "string" && /^[A-Z]{3}$/.test(v) ? v : undefined;
}

/** Where a field's value links to, if anywhere. */
export function linkOf(field: DocField, doc: Doc): { doctype: string; name: string } | null {
	const value = doc[field.fieldname];
	if (typeof value !== "string" || !value || !field.options) return null;
	if (field.fieldtype === "Link") return { doctype: field.options, name: value };
	if (field.fieldtype === "Dynamic Link") {
		const doctype = doc[field.options];
		return typeof doctype === "string" && doctype ? { doctype, name: value } : null;
	}
	return null;
}

export function docStatus(doc: Doc): string | undefined {
	if (doc.docstatus === 1) return "Submitted";
	if (doc.docstatus === 2) return "Cancelled";
	return typeof doc.status === "string" ? doc.status : undefined;
}
