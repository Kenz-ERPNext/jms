// Some reports put HTML in a cell ("<b>Total Net Sales</b>", a coloured <div> as a
// section heading). Show it as plain text, never as HTML, and keep only whether it
// was bold or a heading, so the table can style it.

export interface CellText {
	text: string;
	bold: boolean;
	/** A section heading: the report gave it a background colour. */
	heading: boolean;
}

export function fromHtml(value: string): CellText {
	if (!/<[a-z][^>]*>|&[a-z#0-9]+;/i.test(value)) {
		return { text: value, bold: false, heading: false };
	}
	const doc = new DOMParser().parseFromString(value, "text/html");
	return {
		text: (doc.body.textContent ?? "").replace(/\s+/g, " ").trim(),
		bold: !!doc.querySelector("b, strong, [style*='bold']"),
		heading: !!doc.querySelector("[style*='background']"),
	};
}
