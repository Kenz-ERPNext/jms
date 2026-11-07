// One report cell: the formatted value, as a link when it names a document (plain
// text that shows as a link only on hover). A job opens the job modal; another
// document (a voucher, a GL entry, an account) opens read-only in the document drawer.

import { useOpenDoc } from "@/features/doc-view/DocViewProvider";

import { linkTarget, show, type Row } from "./reportRows";
import type { ReportColumn } from "./useReport";

export default function ReportCell({
	value,
	row,
	col,
}: {
	value: unknown;
	row: Row;
	col: ReportColumn;
}) {
	const openDoc = useOpenDoc();
	const text = show(value, col);
	const target = linkTarget(value, row, col);

	if (target) {
		return (
			<a className="sbm-cell-link" onClick={() => openDoc(target.doctype, target.name)}>
				{text}
			</a>
		);
	}
	return row._total ? <strong>{text}</strong> : <>{text}</>;
}
