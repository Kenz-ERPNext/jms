import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import dayjs, { type Dayjs } from "dayjs";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import FocusDatePicker from "./FocusDatePicker";

// a field with its value held outside, as a Form.Item does
function Field({ start }: { start: string }) {
	const [value, setValue] = useState<Dayjs | null>(dayjs(start));
	return <FocusDatePicker value={value} onChange={setValue} format="DD-MM-YYYY" />;
}

const input = () => screen.getByRole("textbox") as HTMLInputElement;
const calendarOpen = () =>
	document.querySelector(".ant-picker-dropdown:not(.ant-picker-dropdown-hidden)");

describe("FocusDatePicker", () => {
	afterEach(cleanup);

	it("opens on keyboard focus and moves the date with the arrow keys", () => {
		render(<Field start="2026-11-03" />);
		fireEvent.focus(input());
		expect(calendarOpen()).not.toBeNull();

		fireEvent.keyDown(input(), { key: "ArrowRight" });
		expect(input().value).toBe("04-11-2026");
		fireEvent.keyDown(input(), { key: "ArrowDown" });
		expect(input().value).toBe("11-11-2026");
		fireEvent.keyDown(input(), { key: "ArrowUp" });
		fireEvent.keyDown(input(), { key: "ArrowLeft" });
		expect(input().value).toBe("03-11-2026");
	});

	it("leaves a mouse click to the picker itself", () => {
		render(<Field start="2026-11-03" />);
		fireEvent.mouseDown(input());
		fireEvent.focus(input());
		// arrows do nothing to a closed calendar
		fireEvent.keyDown(input(), { key: "ArrowRight" });
		expect(input().value).toBe("03-11-2026");
	});
});
