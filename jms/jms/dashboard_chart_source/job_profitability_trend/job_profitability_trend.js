frappe.provide("frappe.dashboards.chart_sources");

frappe.dashboards.chart_sources["Job Profitability Trend"] = {
	method: "jms.jms.dashboard_chart_source.job_profitability_trend.job_profitability_trend.get",
	filters: [
		{
			fieldname: "company",
			label: __("Company"),
			fieldtype: "Link",
			options: "Company",
			default: frappe.defaults.get_user_default("Company"),
		},
	],
};
