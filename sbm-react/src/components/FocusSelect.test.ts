import { act, renderHook } from "@testing-library/react";
import type { FocusEvent, MouseEvent } from "react";
import { describe, expect, it } from "vitest";

import { useOpenOnFocus } from "./FocusSelect";

const focus = {} as FocusEvent<HTMLElement>;
const mouseDown = {} as MouseEvent<HTMLDivElement>;

describe("useOpenOnFocus", () => {
	it("opens on keyboard focus and closes on blur", () => {
		const { result } = renderHook(() => useOpenOnFocus({}));
		act(() => result.current.onFocus?.(focus));
		expect(result.current.open).toBe(true);
		act(() => result.current.onBlur?.(focus));
		expect(result.current.open).toBe(false);
	});

	it("leaves a mouse click to the select itself", () => {
		const { result } = renderHook(() => useOpenOnFocus({}));
		act(() => result.current.onMouseDown?.(mouseDown));
		act(() => result.current.onFocus?.(focus));
		expect(result.current.open).toBe(false);
		// the next Tab into it opens again
		act(() => result.current.onBlur?.(focus));
		act(() => result.current.onFocus?.(focus));
		expect(result.current.open).toBe(true);
	});

	it("does not open a disabled field", () => {
		const { result } = renderHook(() => useOpenOnFocus({ disabled: true }));
		act(() => result.current.onFocus?.(focus));
		expect(result.current.open).toBe(false);
	});
});
