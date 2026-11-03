// An Ant Design DatePicker whose calendar opens when the field is reached with the
// keyboard (Tab), like FocusSelect, so a date can be picked without the mouse. A mouse
// click still opens and closes it as usual: focus that comes from the pointer is left alone.
// While it is open the arrow keys move the date (antd has no keys for the calendar):
// ← → a day, ↑ ↓ a week; Enter closes it, Tab goes on to the next field.

import { DatePicker, type DatePickerProps } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useRef, useState } from "react";

const STEP: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };

export default function FocusDatePicker(props: DatePickerProps) {
	const [open, setOpen] = useState(false);
	// set on mouse down, which comes before the focus it causes
	const byPointer = useRef(false);
	// the date, also when the field is not controlled by a form
	const [own, setOwn] = useState<Dayjs | null>(props.defaultValue ?? null);
	const value = props.value !== undefined ? props.value : own;
	// the month the calendar shows: follows the arrow keys, reset each time it opens
	const [month, setMonth] = useState<Dayjs>();
	const isOpen = props.open ?? open;

	const show = (v: boolean) => {
		setOpen(v);
		if (v) setMonth(undefined);
	};
	const choose = (d: Dayjs) => {
		setOwn(d);
		setMonth(d);
		props.onChange?.(
			d,
			d.format(typeof props.format === "string" ? props.format : "YYYY-MM-DD"),
		);
	};

	return (
		<DatePicker
			{...props}
			open={isOpen}
			pickerValue={month ?? value ?? undefined}
			onPickerValueChange={(d) => setMonth(d)}
			onChange={(d, text) => (setOwn(d), props.onChange?.(d, text))}
			onOpenChange={(v) => (show(v), props.onOpenChange?.(v))}
			onMouseDown={(e) => ((byPointer.current = true), props.onMouseDown?.(e))}
			onKeyDown={(e, preventDefault) => {
				const step = STEP[e.key];
				if (isOpen && step) {
					e.preventDefault();
					preventDefault();
					choose((value ?? dayjs()).add(step, "day"));
				} else if (isOpen && e.key === "Enter") {
					preventDefault();
					show(false);
				}
				props.onKeyDown?.(e, preventDefault);
			}}
			onFocus={(e, info) => {
				if (!byPointer.current && !props.disabled) show(true);
				byPointer.current = false;
				props.onFocus?.(e, info);
			}}
			onBlur={(e, info) => {
				setOpen(false);
				byPointer.current = false;
				props.onBlur?.(e, info);
			}}
		/>
	);
}
