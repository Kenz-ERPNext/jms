// Number and date formatting for the UI, in the company currency.

import dayjs from "dayjs";

import { getBoot } from "./boot";

export function formatMoney(
	value: number | null | undefined,
	currency = getBoot().currency,
): string {
	const amount = Number(value) || 0;
	try {
		return new Intl.NumberFormat(undefined, {
			style: currency ? "currency" : "decimal",
			currency: currency || undefined,
			maximumFractionDigits: 2,
		}).format(amount);
	} catch {
		// unknown currency code
		return `${currency ?? ""} ${amount.toFixed(2)}`.trim();
	}
}

export function formatDate(value?: string | null): string {
	return value ? dayjs(value).format("DD MMM YYYY") : "";
}

/** A date and time as the server keeps it (its own time zone), e.g. "29 Oct 2026, 17:15". */
export function formatDateTime(value?: string | null): string {
	return value ? dayjs(value).format("DD MMM YYYY, HH:mm") : "";
}

/** Whole days from the date until today (positive = in the past). */
export function daysAgo(value?: string | null, today = dayjs()): number {
	return value ? today.startOf("day").diff(dayjs(value).startOf("day"), "day") : 0;
}
