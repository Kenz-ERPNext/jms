// The one list table of the app (Jobs, Reports, Task Board, Tasks, Activity Log):
// green header from the theme, ten rows a page, "1–10 of N <noun>", and only the
// rows scroll, so the header and the paging stay in view.

import { Table, type TableProps } from "antd";

/** Height left for the rows: the screen minus header, title, filters and paging. */
export const ROWS_HEIGHT = "calc(100vh - 380px)";

export interface DataTableProps<T> extends TableProps<T> {
	/** What a row is, for the count under the table ("jobs", "rows"). */
	noun?: string;
	/** Height of the scrolling rows, when the page has more above the table. */
	rowsHeight?: string;
}

export default function DataTable<T extends object>({
	noun = "rows",
	rowsHeight = ROWS_HEIGHT,
	pagination,
	scroll,
	...props
}: DataTableProps<T>) {
	return (
		<Table<T>
			rowKey="name"
			size="middle"
			scroll={{ x: "max-content", y: rowsHeight, ...scroll }}
			pagination={
				pagination === false
					? false
					: {
							pageSize: 10,
							showSizeChanger: false,
							hideOnSinglePage: true,
							showTotal: (total, [from, to]) =>
								`${from}–${to} of ${total.toLocaleString()} ${noun}`,
							...pagination,
						}
			}
			{...props}
		/>
	);
}
