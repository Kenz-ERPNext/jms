// Extra fields of ERPNext's Customer and Supplier Quick Entry (erpnext/public/js/utils/
// contact_address_quick_entry.js): a primary contact and a primary address. They are
// not fields of the DocType; the server makes the Contact and Address from them on
// insert. Some go under other names, since the real fields are read-only (ALIAS).

import { getBoot } from "@/lib/boot";

export interface QuickField {
	fieldname: string;
	label?: string;
	fieldtype: string;
	options?: string;
	reqd?: number;
	allow_in_quick_entry?: number;
	hidden?: number;
	read_only?: number;
	default?: string;
	/** Shown only when this is true of the form's values. */
	showIf?: (values: Record<string, unknown>) => boolean;
	/** Required only when this is true of the form's values. */
	reqdIf?: (values: Record<string, unknown>) => boolean;
}

const isCompany = (v: Record<string, unknown>) =>
	v.customer_type === "Company" || v.supplier_type === "Company";
const hasAddress = (v: Record<string, unknown>) => !!v.address_line1;

const CONTACT_ADDRESS: QuickField[] = [
	{ fieldname: "contact_section", label: "Primary Contact Details", fieldtype: "Section Break" },
	{ fieldname: "map_to_first_name", label: "First Name", fieldtype: "Data", showIf: isCompany },
	{ fieldname: "map_to_last_name", label: "Last Name", fieldtype: "Data", showIf: isCompany },
	{ fieldname: "email_address", label: "Email Id", fieldtype: "Data", options: "Email" },
	{ fieldname: "mobile_number", label: "Mobile Number", fieldtype: "Data" },
	{ fieldname: "address_section", label: "Primary Address Details", fieldtype: "Section Break" },
	{ fieldname: "address_line1", label: "Address Line 1", fieldtype: "Data" },
	{ fieldname: "address_line2", label: "Address Line 2", fieldtype: "Data" },
	{ fieldname: "pincode", label: "ZIP Code", fieldtype: "Data" },
	{ fieldname: "city", label: "City", fieldtype: "Data", reqdIf: hasAddress },
	{ fieldname: "state", label: "State/Province", fieldtype: "Data" },
	{
		fieldname: "country",
		label: "Country",
		fieldtype: "Link",
		options: "Country",
		reqdIf: hasAddress,
		get default() {
			return getBoot().country;
		},
	},
];

/** The extra fields of a DocType's quick form, after its own. */
export const EXTRA_FIELDS: Record<string, QuickField[]> = {
	Customer: CONTACT_ADDRESS,
	Supplier: CONTACT_ADDRESS,
};

/** Extra field → the name the server reads it under. */
const ALIAS: Record<string, string> = {
	email_address: "email_id",
	mobile_number: "mobile_no",
	map_to_first_name: "first_name",
	map_to_last_name: "last_name",
};

/** The values as the server takes them: aliases renamed, empty ones left out. */
export function toServerNames(values: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(values)
			.filter(([, v]) => v !== undefined && v !== "")
			.map(([k, v]) => [ALIAS[k] ?? k, v]),
	);
}
