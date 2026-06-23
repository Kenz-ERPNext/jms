// Copyright (c) 2026, Kenz and contributors
// SBM Job Pipeline — a two-row stage stepper (lifecycle + work/money) with
// live counts, styled like a process tracker. Cards drill into the data.

frappe.pages["sbm-pipeline"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("SBM — Job Pipeline"),
		single_column: true,
	});

	const $body = $(wrapper).find(".layout-main-section");
	$body.html(`<div class="text-muted" style="padding:24px;">${__("Loading…")}</div>`);

	const CSS = `
	<style>
	.sbm-pipe { padding: 8px 4px 24px; }
	.sbm-pipe .row-title { font-size: 13px; font-weight: 600; color: #6b7280;
		text-transform: uppercase; letter-spacing: .04em; margin: 22px 2px 10px; }
	.sbm-stepper { display: flex; align-items: stretch; flex-wrap: wrap; gap: 0; }
	.sbm-step { background: #e9f7ef; border: 1px solid #c8ebd6; border-radius: 10px;
		padding: 14px 18px; min-width: 150px; text-align: center; cursor: pointer;
		transition: transform .08s ease, box-shadow .08s ease; }
	.sbm-step:hover { transform: translateY(-2px); box-shadow: 0 4px 14px rgba(22,121,72,.18); }
	.sbm-step .chk { width: 22px; height: 22px; line-height: 22px; border-radius: 50%;
		background: #16a34a; color: #fff; font-size: 13px; margin: 0 auto 8px; }
	.sbm-step .lbl { font-size: 12.5px; color: #166848; font-weight: 600; }
	.sbm-step .cnt { font-size: 22px; font-weight: 700; color: #14532d; margin-top: 2px; }
	.sbm-arrow { display: flex; align-items: center; color: #9ca3af; font-size: 20px;
		padding: 0 10px; }
	.sbm-step.zero { background: #f3f4f6; border-color: #e5e7eb; }
	.sbm-step.zero .chk { background: #9ca3af; }
	.sbm-step.zero .lbl { color: #6b7280; }
	.sbm-step.zero .cnt { color: #9ca3af; }
	</style>`;

	function row(title, steps, onClick) {
		const cells = steps.map((s, i) => {
			const zero = !s.count ? "zero" : "";
			const arrow = i < steps.length - 1 ? `<div class="sbm-arrow">&#8594;</div>` : "";
			return `<div class="sbm-step ${zero}" data-key="${frappe.utils.escape_html(s.label)}">
						<div class="chk">&#10003;</div>
						<div class="lbl">${frappe.utils.escape_html(s.label)}</div>
						<div class="cnt">${s.count}</div>
					</div>${arrow}`;
		}).join("");
		return `<div class="row-title">${title}</div><div class="sbm-stepper" data-row="${title}">${cells}</div>`;
	}

	function render(data) {
		let html = CSS + `<div class="sbm-pipe">`;
		html += row(__("Job Lifecycle"), data.lifecycle || []);
		html += row(__("Work &amp; Money Stages"), data.stages || []);
		html += `</div>`;
		$body.html(html);

		// lifecycle cards -> filtered Job list
		$body.find('[data-row="' + __("Job Lifecycle") + '"] .sbm-step').on("click", function () {
			const status = $(this).data("key");
			frappe.set_route("List", "Job", { status: status });
		});
		// stage cards -> Job Status Report with the matching scenario
		const scenarioFor = {
			"Processing Work": "Remaining for Task Completion",
			"Amount Pending": "Remaining for Collection",
			"Exp Pending": "Remaining for Payment",
			"Completed": "All Completed",
		};
		$body.find('[data-row="' + __("Work &amp; Money Stages") + '"] .sbm-step').on("click", function () {
			const sc = scenarioFor[$(this).data("key")];
			frappe.set_route("query-report", "Job Status Report", sc ? { scenario: sc } : {});
		});
	}

	page.set_primary_action(__("Refresh"), load, "refresh");

	function load() {
		frappe.call({
			method: "jms.jms.dashboard_api.pipeline_counts",
			args: { company: frappe.defaults.get_user_default("Company") },
			callback: (r) => render(r.message || {}),
		});
	}

	load();
};
