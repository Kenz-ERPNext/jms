// One report: its filters, summary and rows (shown in the Reports page's modal). The
// filter values are in the URL with the report, so it can be bookmarked or shared.
// It runs again when a filter changes.

import { Alert, Card, Flex, Skeleton, Statistic } from "antd";
import { useMemo } from "react";
import { useSearchParams } from "react-router";

import { formatMoney } from "@/lib/format";
import { tokens } from "@/theme/tokens";

import ReportFilters from "./ReportFilters";
import ReportTable from "./ReportTable";
import { useReportFilters, useReportResult } from "./useReport";

export default function ReportView({ report }: { report: string }) {
	const [params, setParams] = useSearchParams();
	const filtersQuery = useReportFilters(report);

	// filter values: the URL's, else each filter's default
	const values = useMemo(() => {
		if (!filtersQuery.data) return undefined;
		const fromUrl = JSON.parse(params.get("filters") || "null") as Record<
			string,
			unknown
		> | null;
		if (fromUrl) return fromUrl;
		return Object.fromEntries(
			filtersQuery.data
				.filter((f) => f.default !== undefined && f.default !== "")
				.map((f) => [f.fieldname, f.default]),
		);
	}, [filtersQuery.data, params]);
	const result = useReportResult(report, values);

	const missing = (filtersQuery.data ?? []).filter((f) => f.reqd && !values?.[f.fieldname]);
	const setValues = (v: Record<string, unknown>) =>
		setParams((p) => {
			p.set(
				"filters",
				JSON.stringify(
					Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined)),
				),
			);
			return p;
		});
	return (
		<Flex vertical gap={tokens.space.md}>
			{filtersQuery.isLoading ? (
				<Skeleton.Input active block />
			) : (
				<ReportFilters
					filters={filtersQuery.data ?? []}
					values={values ?? {}}
					onChange={setValues}
					onReset={
						params.has("filters")
							? () =>
									setParams((p) => {
										p.delete("filters");
										return p;
									})
							: undefined
					}
				/>
			)}
			{missing.length > 0 && (
				<Alert
					type="info"
					showIcon
					message={`Choose ${missing.map((f) => f.label || f.fieldname).join(", ")} to run this report.`}
				/>
			)}
			{result.error && (
				<Alert
					type="error"
					showIcon
					message="The report could not run"
					description={result.error.message}
				/>
			)}
			{result.data?.message && <Alert type="info" message={String(result.data.message)} />}
			{!!result.data?.report_summary?.length && (
				<Flex wrap gap={tokens.space.md}>
					{result.data.report_summary.map((s) => (
						<Card key={s.label} size="small" style={{ minWidth: 160 }}>
							<Statistic
								title={s.label}
								value={Number(s.value) || 0}
								formatter={(v) =>
									s.datatype === "Currency"
										? formatMoney(Number(v))
										: Number(v).toLocaleString()
								}
							/>
						</Card>
					))}
				</Flex>
			)}
			{!missing.length && (
				<ReportTable
					name={report}
					columns={result.data?.columns ?? []}
					rows={result.data?.result ?? []}
					loading={result.isFetching}
				/>
			)}
		</Flex>
	);
}
