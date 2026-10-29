// An Ant Design Select whose list opens when the field is reached with the keyboard
// (Tab), so a form can be filled with Tab, typing and Enter alone. A mouse click
// still opens and closes it as usual: focus that comes from the pointer is left alone.

import { Select, type SelectProps } from "antd";
import { useRef, useState } from "react";

/** The open state and handlers that open the list on keyboard focus. */
export function useOpenOnFocus(props: SelectProps): SelectProps {
	const [open, setOpen] = useState(false);
	// set on mouse down, which comes before the focus it causes
	const byPointer = useRef(false);
	return {
		open: props.open ?? open,
		onOpenChange: (v) => (setOpen(v), props.onOpenChange?.(v)),
		onMouseDown: (e) => ((byPointer.current = true), props.onMouseDown?.(e)),
		onFocus: (e) => {
			if (!byPointer.current && !props.disabled) setOpen(true);
			byPointer.current = false;
			props.onFocus?.(e);
		},
		onBlur: (e) => {
			setOpen(false);
			byPointer.current = false;
			props.onBlur?.(e);
		},
	};
}

export default function FocusSelect(props: SelectProps) {
	return <Select {...props} {...useOpenOnFocus(props)} />;
}
