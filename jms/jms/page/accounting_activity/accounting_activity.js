// Copyright (c) 2026, Kenz and contributors
// Accounting Activity — a live, plain-language feed of every change made to
// invoices, payments, journal entries and accounts (Accounting Change Log).
// New entries arrive over the realtime socket without a reload.

frappe.pages["accounting-activity"].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __("Accounting Activity"),
		single_column: true,
	});
	new AccountingActivity(page, wrapper);
};

const LOG = "Accounting Change Log";
const PAGE_LENGTH = 30;
const FIELDS = [
	"name", "creation", "action", "reference_doctype", "reference_name", "changed_by",
	"changed_by_name", "party", "amount", "currency", "summary", "details",
];

// colour and icon per action; colours are Frappe's indicator palette
const ACTIONS = {
	Created: { color: "blue", icon: "+" },
	Amended: { color: "blue", icon: "↻" },
	Edited: { color: "orange", icon: "✎" },
	"Edited after Submit": { color: "orange", icon: "✎" },
	Submitted: { color: "green", icon: "✓" },
	Cancelled: { color: "red", icon: "✕" },
	Deleted: { color: "red", icon: "🗑" },
};

class AccountingActivity {
	constructor(page, wrapper) {
		this.page = page;
		this.rows = [];
		this.more = false;
		this.make_filters();
		this.$body = $(`
			<div class="acc-activity">
				<div class="acc-head">
					<div class="text-muted">${__("Every change to invoices, payments and accounts, as it happens.")}</div>
					<div class="acc-live" title="${__("New changes appear here automatically")}">
						<span class="dot"></span>${__("Live")}
					</div>
				</div>
				<div class="acc-feed"></div>
				<div class="acc-more"><button class="btn btn-default btn-sm">${__("Load older changes")}</button></div>
			</div>`).appendTo(page.main);
		this.$feed = this.$body.find(".acc-feed");
		this.$body.find(".acc-more button").on("click", () => this.load(true));
		this.$feed.on("click", ".acc-toggle", function () {
			$(this).closest(".acc-entry").toggleClass("open");
		});
		$(this.css()).appendTo(this.$body);

		this.listen();
		this.load();
		// keep "5 m" fresh; prettyDate gives plain text (comment_when gives HTML,
		// which .text() would show as tags)
		setInterval(() => this.$feed.find("[data-time]").each(function () {
			$(this).text(frappe.datetime.prettyDate($(this).attr("data-time"), true));
		}), 60 * 1000);
	}

	make_filters() {
		const refresh = () => this.load();
		this.filters = {
			reference_doctype: this.page.add_field({
				fieldname: "reference_doctype", label: __("Document Type"), fieldtype: "Select",
				options: ["", "Sales Invoice", "Purchase Invoice", "Payment Entry", "Journal Entry",
					"Payment Request", "Period Closing Voucher", "Account", "Cost Center", "Bank Account",
					"Mode of Payment", "Fiscal Year", "Sales Taxes and Charges Template",
					"Purchase Taxes and Charges Template"].join("\n"),
				change: refresh,
			}),
			action: this.page.add_field({
				fieldname: "action", label: __("Action"), fieldtype: "Select",
				options: ["", ...Object.keys(ACTIONS)].join("\n"), change: refresh,
			}),
			changed_by: this.page.add_field({
				fieldname: "changed_by", label: __("Changed By"), fieldtype: "Link", options: "User",
				change: refresh,
			}),
			from_date: this.page.add_field({
				fieldname: "from_date", label: __("From Date"), fieldtype: "Date", change: refresh,
			}),
			reference_name: this.page.add_field({
				fieldname: "reference_name", label: __("Document"), fieldtype: "Data", change: refresh,
			}),
		};
	}

	get_filters() {
		const f = {};
		for (const [key, field] of Object.entries(this.filters)) {
			const value = field.get_value();
			if (!value) continue;
			if (key === "from_date") f.creation = [">=", value];
			else if (key === "reference_name") f.reference_name = ["like", `%${value}%`];
			else f[key] = value;
		}
		return f;
	}

	matches(row) {
		const f = this.get_filters();
		if (f.reference_doctype && row.reference_doctype !== f.reference_doctype) return false;
		if (f.action && row.action !== f.action) return false;
		if (f.changed_by && row.changed_by !== f.changed_by) return false;
		if (f.creation && row.creation < f.creation[1]) return false;
		const name = this.filters.reference_name.get_value();
		if (name && !(row.reference_name || "").toLowerCase().includes(name.toLowerCase())) return false;
		return true;
	}

	async load(older = false) {
		if (!older) this.rows = [];
		const rows = await frappe.db.get_list(LOG, {
			fields: FIELDS,
			filters: this.get_filters(),
			order_by: "creation desc",
			start: this.rows.length,
			limit: PAGE_LENGTH + 1,
		});
		this.more = rows.length > PAGE_LENGTH;
		this.rows = this.rows.concat(rows.slice(0, PAGE_LENGTH));
		this.render();
	}

	listen() {
		// Frappe only lets a browser into this room when the user may read the log.
		frappe.realtime.doctype_subscribe(LOG);
		frappe.realtime.on("accounting_change_log", (row) => {
			if (!row || this.rows.some((r) => r.name === row.name) || !this.matches(row)) return;
			this.rows.unshift(row);
			this.render(row.name);
		});
	}

	render(fresh) {
		if (!this.rows.length) {
			this.$feed.html(`<div class="acc-empty text-muted">${__("No accounting changes yet.")}</div>`);
		} else {
			let html = "";
			let day = null;
			for (const row of this.rows) {
				const d = row.creation.slice(0, 10);
				if (d !== day) {
					day = d;
					html += `<div class="acc-day">${this.day_label(d)}</div>`;
				}
				html += this.entry(row, row.name === fresh);
			}
			this.$feed.html(html);
		}
		this.$body.find(".acc-more").toggle(this.more);
	}

	day_label(date) {
		const today = frappe.datetime.get_today();
		if (date === today) return __("Today");
		if (date === frappe.datetime.add_days(today, -1)) return __("Yesterday");
		return frappe.datetime.str_to_user(date);
	}

	entry(row, fresh) {
		const esc = frappe.utils.escape_html;
		const a = ACTIONS[row.action] || { color: "gray", icon: "•" };
		const link = row.action === "Deleted"
			? `<b>${esc(row.reference_name)}</b>`
			: `<a href="/app/${frappe.router.slug(row.reference_doctype)}/${encodeURIComponent(row.reference_name)}">${esc(row.reference_name)}</a>`;
		// The summary is "<user> <verb> <doctype> <name> [for <party>]": link the document name.
		const summary = esc(row.summary || "").replace(esc(row.reference_name), link);
		const amount = row.amount
			? `<div class="acc-amount">${format_currency(row.amount, row.currency)}</div>` : "";
		const lines = (row.details || "").split("\n").filter(Boolean);
		const details = lines.length
			? `<button class="btn btn-xs btn-link acc-toggle">
					<span class="show-more">${__("Show {0} change(s)", [lines.length])}</span>
					<span class="show-less">${__("Hide changes")}</span>
				</button>
				<ul class="acc-lines">${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`
			: "";
		return `
			<div class="acc-entry ${fresh ? "fresh" : ""} ${lines.length && lines.length <= 3 ? "open" : ""}">
				<div class="acc-icon indicator-pill ${a.color}">${a.icon}</div>
				<div class="acc-main">
					<div class="acc-top">
						<div class="acc-text">${summary}</div>
						${amount}
					</div>
					<div class="acc-meta text-muted">
						<span class="indicator-pill ${a.color} acc-badge">${__(row.action)}</span>
						<span data-time="${row.creation}" title="${frappe.datetime.str_to_user(row.creation)}">
							${frappe.datetime.prettyDate(row.creation, true)}</span>
					</div>
					${details}
				</div>
			</div>`;
	}

	css() {
		return `<style>
		.acc-activity { padding: 4px 4px 32px; max-width: 920px; }
		.acc-head { display: flex; justify-content: space-between; align-items: center; margin: 4px 2px 12px; gap: 12px; }
		.acc-live { font-size: 12px; font-weight: 600; color: var(--green-600); white-space: nowrap; }
		.acc-live .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%;
			background: var(--green-500); margin-right: 6px; animation: acc-pulse 1.6s infinite; }
		@keyframes acc-pulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }
		.acc-day { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase;
			letter-spacing: .04em; margin: 20px 2px 8px; }
		.acc-entry { display: flex; gap: 12px; padding: 12px 14px; margin-bottom: 8px;
			background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 10px; }
		.acc-entry.fresh { animation: acc-flash 2.5s ease-out; }
		@keyframes acc-flash { 0% { background: var(--yellow-100); transform: translateY(-4px); } 100% { background: var(--card-bg); } }
		.acc-icon.indicator-pill { width: 30px; height: 30px; min-width: 30px; border-radius: 50%; padding: 0;
			justify-content: center; font-size: 14px; }
		.acc-icon.indicator-pill::before { display: none; }
		.acc-main { flex: 1; min-width: 0; }
		.acc-top { display: flex; justify-content: space-between; gap: 12px; }
		.acc-text { color: var(--text-color); overflow-wrap: anywhere; }
		.acc-amount { font-weight: 600; white-space: nowrap; color: var(--text-color); }
		.acc-meta { font-size: 12px; margin-top: 4px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
		.acc-badge { font-size: 11px; }
		.acc-toggle { padding: 0; margin-top: 6px; }
		.acc-lines { display: none; margin: 6px 0 0; padding-left: 18px; font-size: 12.5px; color: var(--text-muted); }
		.acc-entry.open .acc-lines { display: block; }
		.acc-toggle .show-less, .acc-entry.open .acc-toggle .show-more { display: none; }
		.acc-entry.open .acc-toggle .show-less { display: inline; }
		.acc-empty { padding: 40px 0; text-align: center; }
		.acc-more { text-align: center; margin-top: 12px; }
		@media (max-width: 576px) { .acc-top { flex-direction: column; gap: 2px; } }
		</style>`;
	}
}
