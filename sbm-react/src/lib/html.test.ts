import { describe, expect, it } from "vitest";

import { fromHtml } from "./html";

describe("fromHtml", () => {
	it("leaves plain text alone", () => {
		expect(fromHtml("Cash Sales")).toEqual({
			text: "Cash Sales",
			bold: false,
			heading: false,
		});
	});
	it("reads bold text", () => {
		expect(fromHtml("<b>Total Net Sales</b>")).toEqual({
			text: "Total Net Sales",
			bold: true,
			heading: false,
		});
	});
	it("reads a coloured div as a heading", () => {
		const cell = fromHtml(
			"<div style='background-color:#d1f2eb; font-weight:bold;'>&nbsp;▶ Sales Summary</div>",
		);
		expect(cell).toEqual({ text: "▶ Sales Summary", bold: true, heading: true });
	});
	it("never runs markup", () => {
		expect(fromHtml("<img src=x onerror=alert(1)>Hi").text).toBe("Hi");
	});
});
