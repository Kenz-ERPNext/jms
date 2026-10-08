// SBM Dashboard: a Vue app (source in frontend/, built into
// /assets/jms/dashboard/) shown inside the desk, under the normal navbar.
frappe.pages["jms-dashboard"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("SBM Dashboard"),
		single_column: true,
	});

	const el = $('<div class="jms-dashboard"></div>').appendTo(page.main)[0];

	// The build keeps fixed file names, so add a version to skip a stale
	// browser copy after a rebuild (frappe.require does not accept a query).
	const v = Date.now();
	$("<link>", { rel: "stylesheet", href: `/assets/jms/dashboard/jms-dashboard.css?v=${v}` }).appendTo("head");
	const script = document.createElement("script");
	script.src = `/assets/jms/dashboard/jms-dashboard.js?v=${v}`;
	script.onload = () => window.JMSDashboard.mount(el);
	document.head.appendChild(script);
};
