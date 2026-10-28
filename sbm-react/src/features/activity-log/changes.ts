// The "what changed" text the server writes (jms/accounting_log.py, one line per
// change: "Rate (Items row 2 – ITEM-1): 100.00 → 120.00", or "Items: added ITEM-2")
// as rows a table can show: the field, where it is, the value before and after.

export interface Change {
	field: string;
	/** The row of a child table it is in, e.g. "Items row 2 – ITEM-1". */
	where?: string;
	before?: string;
	after?: string;
	/** A row added to or removed from a table. */
	note?: string;
}

const EMPTY = "(empty)";
// Logged before the server skipped it: ERPNext's tax table redrawn as HTML.
const HIDDEN_FIELDS = new Set(["Taxes and Charges Calculation"]);

export function parseChanges(details?: string): Change[] {
	return (
		(details ?? "")
			.split("\n")
			.map((l) => l.trim())
			// every change is "Label: ..."; other lines are left-overs of an HTML value
			.filter((line) => line.includes(": "))
			.map((line): Change => {
				const colon = line.indexOf(": ");
				const label = line.slice(0, colon);
				const rest = line.slice(colon + 2);
				const m = label.match(/^(.*?) \((.*)\)$/);
				const [field, where] = m ? [m[1], m[2]] : [label, undefined];
				const arrow = rest.indexOf(" → ");
				if (arrow < 0) return { field, where, note: rest };
				const value = (v: string) => (v === EMPTY ? undefined : v);
				return {
					field,
					where,
					before: value(rest.slice(0, arrow)),
					after: value(rest.slice(arrow + 3)),
				};
			})
			.filter((c) => !HIDDEN_FIELDS.has(c.field))
	);
}

/** One short line for the collapsed row: "Total Quantity 31 → 35 · Items: removed 898". */
export function changeSummary(changes: Change[], max = 2): string {
	const part = (c: Change) =>
		c.note ? `${c.field}: ${c.note}` : `${c.field} ${c.before ?? "–"} → ${c.after ?? "–"}`;
	const shown = changes.slice(0, max).map(part).join(" · ");
	return changes.length > max ? `${shown} · +${changes.length - max} more` : shown;
}
