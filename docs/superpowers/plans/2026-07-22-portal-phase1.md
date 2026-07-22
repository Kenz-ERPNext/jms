# JMS Portal Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Vue 3 + frappe-ui single-page portal at `/portal` on oasis.local with a KPI dashboard and read-only job browsing, per `docs/superpowers/specs/2026-07-22-portal-phase1-design.md`.

**Architecture:** Three permission-guarded whitelisted endpoints in a new `jms/jms/portal_api.py` feed a Vite-built Vue SPA that lives in `frontend/` and is served by `jms/www/portal.py` + a catch-all website route rule. Design tokens, layout, and the hand-rolled SVG profit chart are ported from the approved artifact mockup (`jms-portal-preview.html`).

**Tech Stack:** Frappe v15 (site oasis.local), Python 3.14 FrappeTestCase, Vue 3, vue-router 4, frappe-ui (data layer only: `createResource`/`frappeRequest`), Vite 5, hand-written CSS tokens (no Tailwind in Phase 1), playwright-core + local Chrome for UI smoke.

## Global Constraints

- Site for all bench commands and tests: `oasis.local` (`allow_tests` already true).
- Every portal endpoint's first statement: `frappe.has_permission("Job", "read", throw=True)`.
- Phase 1 is read-only: no mutations anywhere in `portal_api.py` or the SPA.
- Chart palette (validated): light `#2f9e8f` income / `#c1862b` expense / `#3d6bd8` net profit / `#c0392b` negative; dark `#2fa896` / `#bd8226` / `#5b83e8` / `#e06a5c`.
- Sidebar brand: "KENZ TECHNOLOGY"; future nav items greyed with a "soon" tag (Invoices & Payments, Reports, Profitability, Customers & Agents).
- Payment tolerance and stage rules must mirror `Job.validate_closing` / `job.js buildJobPipeline` exactly (documented per task below).
- Commit after every task; never commit `frontend/node_modules` or `jms/public/frontend` build output except the built files needed to serve (see Task 4 `.gitignore` decision: build output IS committed so production works without node).
- Node 20 (`~/.nvm/versions/node/v20.20.2`), run frontend commands from `apps/jms/frontend`.
- Playwright smoke uses `bench --site oasis.local browse --user Administrator` to mint a login sid; Chrome binary `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`.

---

### Task 1: `portal_api.dashboard()`

**Files:**
- Create: `jms/jms/portal_api.py`
- Create: `jms/jms/test_portal_api.py`

**Interfaces:**
- Consumes: `jms.jms.dashboard_api.get_totals(company)` → dict with keys `total_job_amount, total_expenses, outsourcing_cost, net_profit, total_received, outstanding`; `jms.jms.dashboard_chart_source.job_profitability_trend.job_profitability_trend.get(filters=...)` → `{"labels": [...], "datasets": [{"name","values"}...]}`.
- Produces: `jms.jms.portal_api.dashboard(company=None)` → `{"kpis": {...7 keys...}, "currency": str|None, "profit_trend": [{"month","income","expense","net_profit"}], "recent_payments": [...], "recent_jobs": [...]}` — consumed by Task 6.

- [ ] **Step 1: Write the failing tests**

Create `jms/jms/test_portal_api.py`:

```python
# Copyright (c) 2026, Kenz and contributors
# Tests for the JMS Portal (Phase 1) API. Read-only endpoints; run against
# whatever data the site has — assertions are shape-based, not value-based.

import frappe
from frappe.tests.utils import FrappeTestCase

from jms.jms import portal_api


class TestPortalDashboard(FrappeTestCase):
	def test_dashboard_payload_shape(self):
		out = portal_api.dashboard()
		self.assertEqual(
			set(out.keys()),
			{"kpis", "currency", "profit_trend", "recent_payments", "recent_jobs"},
		)
		self.assertEqual(
			set(out["kpis"].keys()),
			{
				"total_job_amount", "total_received", "outstanding",
				"supplier_balance", "total_expenses", "outsourcing_cost",
				"net_profit", "job_count",
			},
		)
		self.assertLessEqual(len(out["profit_trend"]), 6)
		for row in out["profit_trend"]:
			self.assertEqual(set(row.keys()), {"month", "income", "expense", "net_profit"})
		self.assertLessEqual(len(out["recent_payments"]), 8)
		for p in out["recent_payments"]:
			self.assertEqual(
				set(p.keys()),
				{"posting_date", "party", "payment_type", "amount", "job"},
			)
		self.assertLessEqual(len(out["recent_jobs"]), 5)
		for j in out["recent_jobs"]:
			self.assertEqual(
				set(j.keys()),
				{"name", "job_title", "customer", "agent", "status", "amount", "outstanding"},
			)

	def test_dashboard_denies_guest(self):
		frappe.set_user("Guest")
		try:
			self.assertRaises(frappe.PermissionError, portal_api.dashboard)
		finally:
			frappe.set_user("Administrator")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/sammishthundiyil/frappe-bench-15 && bench --site oasis.local run-tests --module jms.jms.test_portal_api`
Expected: ERROR — `ModuleNotFoundError`/`ImportError` (portal_api does not exist).

- [ ] **Step 3: Implement `dashboard()`**

Create `jms/jms/portal_api.py`:

```python
# Copyright (c) 2026, Kenz and contributors
# JMS Portal (Phase 1) API — read-only, permission-guarded endpoints for the
# Vue SPA at /portal. Every endpoint requires read permission on Job.

import frappe
from frappe.utils import flt

from jms.jms.dashboard_api import get_totals


def _require_job_read():
	frappe.has_permission("Job", "read", throw=True)


@frappe.whitelist()
def dashboard(company=None):
	"""One payload for the portal dashboard: KPI totals, 6-month profit
	trend, recent job payments (last 7 days, max 8) and 5 latest jobs."""
	_require_job_read()

	totals = get_totals(company)

	# Supplier balance = unpaid job purchase invoices net of unallocated
	# pay-side advances — the same derivation as get_financials.net_payable,
	# summed across all jobs.
	cond, params = "", {}
	if company:
		cond = " AND company = %(company)s"
		params["company"] = company
	payable_outstanding = flt(frappe.db.sql(
		f"""SELECT COALESCE(SUM(outstanding_amount), 0) FROM `tabPurchase Invoice`
			WHERE docstatus = 1 AND job IS NOT NULL AND job != ''{cond}""",
		params,
	)[0][0])
	unallocated_paid = flt(frappe.db.sql(
		f"""SELECT COALESCE(SUM(unallocated_amount), 0) FROM `tabPayment Entry`
			WHERE docstatus = 1 AND payment_type = 'Pay'
			  AND job IS NOT NULL AND job != ''{cond}""",
		params,
	)[0][0])
	supplier_balance = max(0.0, payable_outstanding - unallocated_paid)

	job_filters = {"company": company} if company else {}
	kpis = {
		"total_job_amount": flt(totals.get("total_job_amount")),
		"total_received": flt(totals.get("total_received")),
		"outstanding": flt(totals.get("outstanding")),
		"supplier_balance": supplier_balance,
		"total_expenses": flt(totals.get("total_expenses")),
		"outsourcing_cost": flt(totals.get("outsourcing_cost")),
		"net_profit": flt(totals.get("net_profit")),
		"job_count": frappe.db.count("Job", job_filters),
	}

	from jms.jms.dashboard_chart_source.job_profitability_trend.job_profitability_trend import (
		get as get_trend,
	)
	trend = get_trend(filters={"company": company} if company else None)
	months = trend["labels"][-6:]
	offset = len(trend["labels"]) - len(months)
	series = {d["name"]: d["values"] for d in trend["datasets"]}
	profit_trend = [
		{
			"month": m,
			"income": flt(series["Income"][offset + i]),
			"expense": flt(series["Expense"][offset + i]),
			"net_profit": flt(series["Net Profit"][offset + i]),
		}
		for i, m in enumerate(months)
	]

	recent_payments = frappe.db.sql(
		f"""SELECT posting_date, COALESCE(party_name, party) AS party,
			payment_type, paid_amount AS amount, job
			FROM `tabPayment Entry`
			WHERE docstatus = 1 AND job IS NOT NULL AND job != ''
			  AND posting_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY){cond}
			ORDER BY posting_date DESC, modified DESC LIMIT 8""",
		params,
		as_dict=True,
	)

	recent_jobs = frappe.db.sql(
		f"""SELECT j.name, j.job_title, j.customer, j.agent, j.status,
			COALESCE(j.net_amount, 0) AS amount,
			COALESCE((SELECT SUM(si.outstanding_amount) FROM `tabSales Invoice` si
				WHERE si.job = j.name AND si.docstatus = 1), 0) AS outstanding
			FROM `tabJob` j WHERE 1=1{cond.replace('company', 'j.company')}
			ORDER BY j.modified DESC LIMIT 5""",
		params,
		as_dict=True,
	)

	return {
		"kpis": kpis,
		"currency": frappe.get_cached_value("Company", company, "default_currency")
			if company else frappe.db.get_default("currency"),
		"profit_trend": profit_trend,
		"recent_payments": recent_payments,
		"recent_jobs": recent_jobs,
	}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/sammishthundiyil/frappe-bench-15 && bench --site oasis.local run-tests --module jms.jms.test_portal_api`
Expected: `Ran 2 tests ... OK`

- [ ] **Step 5: Commit**

```bash
git add jms/jms/portal_api.py jms/jms/test_portal_api.py
git commit -m "feat(portal): dashboard endpoint (KPIs, 6-month trend, recent feeds)"
```

---

### Task 2: `portal_api.job_list()`

**Files:**
- Modify: `jms/jms/portal_api.py` (append)
- Modify: `jms/jms/test_portal_api.py` (append)

**Interfaces:**
- Produces: `job_list(status=None, customer=None, agent=None, search=None, start=0, page_length=20)` → `{"rows": [{name, job_title, customer, agent, status, date, amount, outstanding}], "total": int}` — consumed by Task 7.

- [ ] **Step 1: Write the failing tests** (append to `test_portal_api.py`)

```python
class TestPortalJobList(FrappeTestCase):
	def test_job_list_shape_and_pagination(self):
		out = portal_api.job_list(page_length=3)
		self.assertEqual(set(out.keys()), {"rows", "total"})
		self.assertLessEqual(len(out["rows"]), 3)
		self.assertIsInstance(out["total"], int)
		for r in out["rows"]:
			self.assertEqual(
				set(r.keys()),
				{"name", "job_title", "customer", "agent", "status", "date",
				 "amount", "outstanding"},
			)
		# page 2 differs from page 1 when enough rows exist
		if out["total"] > 3:
			page2 = portal_api.job_list(start=3, page_length=3)
			self.assertNotEqual(
				[r["name"] for r in out["rows"]],
				[r["name"] for r in page2["rows"]],
			)

	def test_job_list_status_filter_and_search(self):
		out = portal_api.job_list(status="Created", page_length=5)
		for r in out["rows"]:
			self.assertEqual(r["status"], "Created")
		if out["rows"]:
			needle = out["rows"][0]["name"]
			hit = portal_api.job_list(search=needle)
			self.assertIn(needle, [r["name"] for r in hit["rows"]])

	def test_job_list_denies_guest(self):
		frappe.set_user("Guest")
		try:
			self.assertRaises(frappe.PermissionError, portal_api.job_list)
		finally:
			frappe.set_user("Administrator")
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd /Users/sammishthundiyil/frappe-bench-15 && bench --site oasis.local run-tests --module jms.jms.test_portal_api`
Expected: 2 pass (Task 1), 3 ERROR with `AttributeError: ... has no attribute 'job_list'`.

- [ ] **Step 3: Implement `job_list()`** (append to `portal_api.py`)

```python
@frappe.whitelist()
def job_list(status=None, customer=None, agent=None, search=None, start=0, page_length=20):
	"""Paginated, filterable job list for the portal Jobs page."""
	_require_job_read()

	start, page_length = int(start), min(int(page_length), 100)
	conditions, params = ["1=1"], {}
	if status:
		conditions.append("j.status = %(status)s")
		params["status"] = status
	if customer:
		conditions.append("j.customer = %(customer)s")
		params["customer"] = customer
	if agent:
		conditions.append("j.agent = %(agent)s")
		params["agent"] = agent
	if search:
		conditions.append(
			"(j.name LIKE %(search)s OR j.job_title LIKE %(search)s"
			" OR j.customer LIKE %(search)s)"
		)
		params["search"] = f"%{search}%"
	where = " AND ".join(conditions)

	rows = frappe.db.sql(
		f"""SELECT j.name, j.job_title, j.customer, j.agent, j.status, j.date,
			COALESCE(j.net_amount, 0) AS amount,
			COALESCE((SELECT SUM(si.outstanding_amount) FROM `tabSales Invoice` si
				WHERE si.job = j.name AND si.docstatus = 1), 0) AS outstanding
			FROM `tabJob` j WHERE {where}
			ORDER BY j.modified DESC LIMIT %(start)s, %(page_length)s""",
		{**params, "start": start, "page_length": page_length},
		as_dict=True,
	)
	total = frappe.db.sql(
		f"SELECT COUNT(*) FROM `tabJob` j WHERE {where}", params
	)[0][0]
	return {"rows": rows, "total": int(total)}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `cd /Users/sammishthundiyil/frappe-bench-15 && bench --site oasis.local run-tests --module jms.jms.test_portal_api`
Expected: `Ran 5 tests ... OK`

- [ ] **Step 5: Commit**

```bash
git add jms/jms/portal_api.py jms/jms/test_portal_api.py
git commit -m "feat(portal): paginated job_list endpoint with filters and search"
```

---

### Task 3: `portal_api.job_detail()` (stepper stages server-side)

**Files:**
- Modify: `jms/jms/portal_api.py` (append)
- Modify: `jms/jms/test_portal_api.py` (append)

**Interfaces:**
- Consumes: `frappe.get_doc("Job", name).get_financials()` → dict with `metrics` (list of `{key,label,value,visible}`), `currency`, `has_sales_invoice`, `net_receivable`, `net_payable`, `indicators`.
- Produces: `job_detail(name)` → `{"job": {...header...}, "lifecycle": {"steps": [...4 labels...], "active": int, "dead": bool}, "work_money": {"steps": [...5 labels...], "active": int}, "financials": {"currency", "metrics": [visible metrics only]}, "indicators": {...}, "tasks": [...], "linked": {"sales_invoices": [...], "purchase_invoices": [...], "payments": [...]}}` — consumed by Task 8.

The stage rules MUST mirror `job.js buildJobPipeline` (job.js:2160-2181):
lifecycle index from status (`Processing/Supervisor Approved/MD Approved` → 1, unknown → 0, dead = Cancelled/Canceled/Rejected); work/money: tasks not all Completed → 0 (empty task list counts as done), no submitted SI → 1, `net_receivable > 0` → 2, `net_payable > 0` → 3, else 4.

- [ ] **Step 1: Write the failing tests** (append to `test_portal_api.py`)

```python
class TestPortalJobDetail(FrappeTestCase):
	def _any_job(self):
		names = frappe.get_all("Job", limit=1, pluck="name", order_by="modified desc")
		if not names:
			self.skipTest("site has no Job records")
		return names[0]

	def test_job_detail_shape_and_stage_consistency(self):
		out = portal_api.job_detail(self._any_job())
		self.assertEqual(
			set(out.keys()),
			{"job", "lifecycle", "work_money", "financials", "indicators",
			 "tasks", "linked"},
		)
		self.assertEqual(out["lifecycle"]["steps"],
			["Created", "In Progress", "Completed", "Closed"])
		self.assertEqual(out["work_money"]["steps"],
			["Processing Work", "Invoice Pending", "Amount Pending",
			 "Exp Pending", "Completed"])
		self.assertIn(out["lifecycle"]["active"], range(4))
		self.assertIn(out["work_money"]["active"], range(5))
		# only metrics flagged visible by JMS Settings are exposed
		for m in out["financials"]["metrics"]:
			self.assertTrue(m["visible"])
		self.assertEqual(
			set(out["linked"].keys()),
			{"sales_invoices", "purchase_invoices", "payments"},
		)

	def test_job_detail_stage_rules(self):
		# a job with a pending task must sit at work_money stage 0
		pending = frappe.db.sql(
			"""SELECT t.parent FROM `tabJob Task` t
				WHERE t.parenttype='Job' AND COALESCE(t.status,'') != 'Completed'
				LIMIT 1"""
		)
		if pending:
			out = portal_api.job_detail(pending[0][0])
			self.assertEqual(out["work_money"]["active"], 0)

	def test_job_detail_unknown_name_raises(self):
		self.assertRaises(
			frappe.DoesNotExistError, portal_api.job_detail, "JOB-DOES-NOT-EXIST"
		)

	def test_job_detail_denies_guest(self):
		name = self._any_job()
		frappe.set_user("Guest")
		try:
			self.assertRaises(frappe.PermissionError, portal_api.job_detail, name)
		finally:
			frappe.set_user("Administrator")
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd /Users/sammishthundiyil/frappe-bench-15 && bench --site oasis.local run-tests --module jms.jms.test_portal_api`
Expected: 5 pass, 4 ERROR with `AttributeError: ... 'job_detail'`.

- [ ] **Step 3: Implement `job_detail()`** (append to `portal_api.py`)

```python
LIFECYCLE_STEPS = ["Created", "In Progress", "Completed", "Closed"]
WORK_MONEY_STEPS = [
	"Processing Work", "Invoice Pending", "Amount Pending", "Exp Pending", "Completed",
]
DEAD_STATUSES = {"Cancelled", "Canceled", "Rejected"}


@frappe.whitelist()
def job_detail(name):
	"""Everything the portal job page shows. Stage rules mirror the desk
	stepper (job.js buildJobPipeline) exactly."""
	_require_job_read()

	doc = frappe.get_doc("Job", name)
	fin = doc.get_financials()

	# lifecycle position (job.js:2164-2170)
	status = doc.status or "Created"
	if status in LIFECYCLE_STEPS:
		life_active = LIFECYCLE_STEPS.index(status)
	elif status in ("Processing", "Supervisor Approved", "MD Approved"):
		life_active = 1
	else:
		life_active = 0

	# work/money position (job.js:2173-2181); empty task list counts as done
	tasks = doc.tasks or []
	tasks_done = all((t.status or "") == "Completed" for t in tasks)
	if not tasks_done:
		wm_active = 0
	elif not fin.get("has_sales_invoice"):
		wm_active = 1
	elif flt(fin.get("net_receivable")) > 0:
		wm_active = 2
	elif flt(fin.get("net_payable")) > 0:
		wm_active = 3
	else:
		wm_active = 4

	linked = {
		"sales_invoices": frappe.get_all(
			"Sales Invoice", filters={"job": name, "docstatus": 1},
			fields=["name", "posting_date", "grand_total", "outstanding_amount"],
		),
		"purchase_invoices": frappe.get_all(
			"Purchase Invoice", filters={"job": name, "docstatus": 1},
			fields=["name", "supplier", "posting_date", "grand_total", "outstanding_amount"],
		),
		"payments": frappe.get_all(
			"Payment Entry", filters={"job": name, "docstatus": 1},
			fields=["name", "posting_date", "payment_type", "party_name", "paid_amount"],
		),
	}

	return {
		"job": {
			"name": doc.name,
			"job_title": doc.job_title,
			"customer": doc.customer,
			"agent": doc.agent,
			"status": status,
			"date": doc.date,
			"net_amount": flt(doc.net_amount),
			"closing_date": doc.closing_date,
		},
		"lifecycle": {
			"steps": LIFECYCLE_STEPS,
			"active": life_active,
			"dead": status in DEAD_STATUSES,
		},
		"work_money": {"steps": WORK_MONEY_STEPS, "active": wm_active},
		"financials": {
			"currency": fin.get("currency"),
			"metrics": [m for m in fin.get("metrics", []) if m.get("visible")],
		},
		"indicators": fin.get("indicators", {}),
		"tasks": [
			{
				"task_name": t.task_name,
				"assigned": t.get("assigned_to") or t.get("outsource_supplier"),
				"outsourced": t.get("employee__outsource") == "Outsource",
				"due_date": t.get("due_date"),
				"status": t.status,
			}
			for t in tasks
		],
		"linked": linked,
	}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `cd /Users/sammishthundiyil/frappe-bench-15 && bench --site oasis.local run-tests --module jms.jms.test_portal_api`
Expected: `Ran 9 tests ... OK` (stage-rule test may skip if no pending-task job exists).

- [ ] **Step 5: Commit**

```bash
git add jms/jms/portal_api.py jms/jms/test_portal_api.py
git commit -m "feat(portal): job_detail endpoint with server-side stepper stages"
```

---

### Task 4: Serving scaffold — Vite project, `/portal` route, first build

**Files:**
- Create: `frontend/package.json`, `frontend/vite.config.js`, `frontend/index.html`, `frontend/.gitignore`, `frontend/src/main.js`, `frontend/src/App.vue`
- Create: `jms/www/portal.py`
- Modify: `hooks.py` (add `website_route_rules`)
- Generated by build (committed): `jms/public/frontend/*`, `jms/www/portal.html`

**Interfaces:**
- Produces: a served SPA shell at `http://127.0.0.1:8000/portal` (auth-gated); `window.csrf_token` present for frappe-ui; consumed by every later task.

- [ ] **Step 1: Scaffold the Vite project**

`frontend/package.json`:

```json
{
  "name": "jms-portal",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build && cp ../jms/public/frontend/index.html ../jms/www/portal.html"
  },
  "dependencies": {
    "frappe-ui": "^0.1.108",
    "vue": "^3.4.0",
    "vue-router": "^4.3.0"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.0",
    "vite": "^5.2.0",
    "playwright-core": "^1.45.0"
  }
}
```

`frontend/vite.config.js`:

```js
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  base: "/assets/jms/frontend/",
  build: {
    outDir: "../jms/public/frontend",
    emptyOutDir: true,
    target: "es2015",
  },
  server: {
    port: 8080,
    proxy: {
      "^/(app|api|assets|files|login)": { target: "http://127.0.0.1:8000" },
    },
  },
});
```

`frontend/index.html` (the Jinja placeholder survives the build; Frappe renders it when serving `www/portal.html`):

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>JMS Portal</title>
    <script>window.csrf_token = "{{ csrf_token }}";</script>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

`frontend/.gitignore`:

```
node_modules
```

`frontend/src/main.js` (minimal for this task; Task 5 extends it):

```js
import { createApp } from "vue";
import { setConfig, frappeRequest } from "frappe-ui";
import App from "./App.vue";

setConfig("resourceFetcher", frappeRequest);
createApp(App).mount("#app");
```

`frontend/src/App.vue` (placeholder proving the pipeline; replaced in Task 5):

```vue
<template>
  <h1 style="font-family: sans-serif; padding: 2rem">JMS Portal — scaffold OK</h1>
</template>
```

- [ ] **Step 2: Serve it — `jms/www/portal.py` + route rule**

`jms/www/portal.py`:

```python
import frappe

no_cache = 1


def get_context(context):
	if frappe.session.user == "Guest":
		frappe.local.flags.redirect_location = "/login?redirect-to=/portal"
		raise frappe.Redirect
	context.csrf_token = frappe.sessions.get_csrf_token()
	return context
```

In `hooks.py`, directly below the `doc_events` block (hooks.py:150), add:

```python
# JMS Portal SPA — deep links like /portal/jobs/JOB-0001 all resolve to the
# built index (vue-router handles the path client-side)
website_route_rules = [
	{"from_route": "/portal/<path:app_path>", "to_route": "portal"},
]
```

- [ ] **Step 3: Install and build**

Run: `cd /Users/sammishthundiyil/frappe-bench-15/apps/jms/frontend && npm install && npm run build`
Expected: vite build succeeds; `jms/public/frontend/` contains `index.html` + `assets/`; `jms/www/portal.html` exists.

- [ ] **Step 4: Clear cache and verify the route end-to-end**

Run:
```bash
cd /Users/sammishthundiyil/frappe-bench-15 && bench --site oasis.local clear-cache
SID=$(bench --site oasis.local browse --user Administrator 2>/dev/null | grep -o 'sid=[a-f0-9]*' | cut -d= -f2)
curl -s -o /dev/null -w "guest:%{http_code} " "http://127.0.0.1:8000/portal"
curl -s -b "sid=$SID" "http://127.0.0.1:8000/portal" | grep -o "JMS Portal" | head -1
curl -s -b "sid=$SID" -o /dev/null -w "deep:%{http_code}\n" "http://127.0.0.1:8000/portal/jobs/anything"
```
Expected: `guest:302` (redirect to login), `JMS Portal` (title served), `deep:200` (catch-all works).

- [ ] **Step 5: Commit**

```bash
git add frontend jms/www/portal.py jms/www/portal.html jms/public/frontend hooks.py
git commit -m "feat(portal): Vite+Vue scaffold served at /portal with auth gate"
```

---

### Task 5: App shell, router, design tokens

**Files:**
- Create: `frontend/src/router.js`, `frontend/src/portal.css`, `frontend/src/format.js`, `frontend/src/components/AppShell.vue`, `frontend/src/components/StatusChip.vue`
- Modify: `frontend/src/main.js`, `frontend/src/App.vue`
- Create (placeholder pages so the router compiles; filled in Tasks 6-8): `frontend/src/pages/Dashboard.vue`, `frontend/src/pages/JobsList.vue`, `frontend/src/pages/JobDetail.vue`

**Interfaces:**
- Produces: routes `/` (Dashboard), `/jobs` (JobsList), `/jobs/:name` (JobDetail) under history base `/portal`; CSS custom properties (`--panel`, `--ink`, `--brand`, `--c-income` …) exactly as in the approved mockup; `fmtMoney(v)` → `"1,008,412.50"`; `<StatusChip :status="...">`; `<AppShell>` with slot.

- [ ] **Step 1: Port the design tokens.** Copy the full `:root` / `@media (prefers-color-scheme: dark)` token block and component CSS from the approved mockup (`scratchpad jms-portal-preview.html`, already reviewed) into `frontend/src/portal.css`, dropping the `data-theme` override blocks (the portal follows the OS theme in Phase 1 — YAGNI) and the mockup-only `.hidden` view-switching class. Keep every class the mockup defines (`.side`, `.nav`, `.kpi`, `.panel`, `.stepper`, `.chip`, `.feed`, table styles) verbatim so Tasks 6-8 can use them unchanged.

- [ ] **Step 2: Router + helpers**

`frontend/src/router.js`:

```js
import { createRouter, createWebHistory } from "vue-router";

export default createRouter({
  history: createWebHistory("/portal"),
  routes: [
    { path: "/", name: "dashboard", component: () => import("./pages/Dashboard.vue") },
    { path: "/jobs", name: "jobs", component: () => import("./pages/JobsList.vue") },
    { path: "/jobs/:name", name: "job-detail", component: () => import("./pages/JobDetail.vue"), props: true },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});
```

`frontend/src/format.js`:

```js
export const fmtMoney = (v) =>
  Number(v ?? 0).toLocaleString("en", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export const fmtDate = (d) => (d ? String(d) : "—");
```

`frontend/src/main.js` becomes:

```js
import { createApp } from "vue";
import { setConfig, frappeRequest } from "frappe-ui";
import App from "./App.vue";
import router from "./router";
import "./portal.css";

setConfig("resourceFetcher", frappeRequest);
createApp(App).use(router).mount("#app");
```

`frontend/src/App.vue`:

```vue
<template>
  <AppShell><router-view /></AppShell>
</template>

<script setup>
import AppShell from "./components/AppShell.vue";
</script>
```

- [ ] **Step 3: `AppShell.vue`** — sidebar + content slot, porting the mockup sidebar markup. Nav uses `<router-link>` for Dashboard and Jobs; the four "soon" items are inert `<div class="nav soon">`. Job count badge fetches nothing here — Dashboard passes it via a tiny event bus? No: YAGNI, the badge is static text "Jobs" without a count in the shell (the count lives on the Jobs page header).

```vue
<template>
  <div class="app">
    <aside class="side">
      <div class="logo">
        <div class="logo-mark">K</div>
        <div><b>KENZ</b><small>TECHNOLOGY</small></div>
      </div>
      <div class="sec">Workspace</div>
      <router-link class="nav" :class="{ on: route.name === 'dashboard' }" to="/">Dashboard</router-link>
      <router-link class="nav" :class="{ on: String(route.name).startsWith('job') }" to="/jobs">Jobs</router-link>
      <div class="nav soon">Invoices &amp; Payments <span class="soon-tag">soon</span></div>
      <div class="nav soon">Reports <span class="soon-tag">soon</span></div>
      <div class="nav soon">Profitability <span class="soon-tag">soon</span></div>
      <div class="sec">Masters</div>
      <div class="nav soon">Customers &amp; Agents <span class="soon-tag">soon</span></div>
      <div class="side-foot">
        <div class="avatar">{{ initial }}</div>
        <div><b>{{ user }}</b><span>JMS Portal</span></div>
      </div>
    </aside>
    <main class="main"><slot /></main>
  </div>
</template>

<script setup>
import { useRoute } from "vue-router";
const route = useRoute();
const user = window.frappe?.boot?.user?.full_name || "Signed in";
const initial = (user[0] || "U").toUpperCase();
</script>
```

- [ ] **Step 4: `StatusChip.vue`**

```vue
<template>
  <span class="chip" :class="cls">● {{ status }}</span>
</template>

<script setup>
import { computed } from "vue";
const props = defineProps({ status: String });
const cls = computed(() => {
  if (["Completed", "Closed"].includes(props.status)) return "done";
  if (["In Progress", "Processing"].includes(props.status)) return "prog";
  return "created";
});
</script>
```

- [ ] **Step 5: Placeholder pages** — each of `Dashboard.vue`, `JobsList.vue`, `JobDetail.vue` is, for now:

```vue
<template><div class="panel" style="padding: 18px">Coming in the next task.</div></template>
```

- [ ] **Step 6: Build and verify**

Run: `cd /Users/sammishthundiyil/frappe-bench-15/apps/jms/frontend && npm run build && cd /Users/sammishthundiyil/frappe-bench-15 && bench --site oasis.local clear-cache`
Then re-run the Task 4 Step 4 curl block.
Expected: build OK; authenticated curl of `/portal` returns HTML (sidebar markup verified visually in Task 9's smoke).

- [ ] **Step 7: Commit**

```bash
git add frontend jms/www/portal.html jms/public/frontend
git commit -m "feat(portal): app shell, router, design tokens"
```

---

### Task 6: Dashboard page

**Files:**
- Create: `frontend/src/components/KpiCard.vue`, `frontend/src/components/ProfitTrendChart.vue`
- Modify: `frontend/src/pages/Dashboard.vue`

**Interfaces:**
- Consumes: `portal_api.dashboard` payload (Task 1); `fmtMoney`, `StatusChip`, CSS classes from Task 5.
- Produces: the complete dashboard route.

- [ ] **Step 1: `KpiCard.vue`**

```vue
<template>
  <div class="kpi">
    <div class="k-label"><span class="dot" :style="{ background: dot }"></span>{{ label }}</div>
    <div class="k-value num" :style="valueStyle">{{ fmtMoney(value) }}</div>
    <div class="k-sub" v-if="sub">{{ sub }}</div>
  </div>
</template>

<script setup>
import { fmtMoney } from "../format";
defineProps({
  label: String,
  value: Number,
  sub: String,
  dot: { type: String, default: "var(--ink-3)" },
  valueStyle: { type: Object, default: () => ({}) },
});
</script>
```

- [ ] **Step 2: `ProfitTrendChart.vue`** — port the mockup's SVG grouped-bar chart (`draw()` in the approved preview) into a Vue component with `props: { data: Array }` where each item is `{month, income, expense, net_profit}`. Bars: income `var(--c-income)`, expense `var(--c-expense)`, net profit `var(--c-profit)` or `var(--c-neg)` when negative; 4px rounded data-ends, 2px gaps, y-axis gridlines from the computed max/min, direct value labels ≥ 100, hover tooltip showing `month · series · amount`, legend row rendered by the parent panel header. Scale bounds computed from the data (`maxV = max(values)*1.15`, `minV = min(0, min(values)*1.15)`) instead of the mockup's hard-coded 60k/−30k.

- [ ] **Step 3: `Dashboard.vue`** — five KPI cards (Total Job Amount with `across N jobs · ex-VAT` sub from `kpis.job_count`; Received with collected % = `total_received / total_job_amount`; Outstanding in `var(--warn)`; Total Expenses with `incl. outsourcing` sub; Net Profit in `var(--good)`), the trend panel, the payments feed (receive rows green `+amount`, pay rows amber `−amount`), and the recent-jobs table where each row is a `<router-link>`-driven navigation to `/jobs/<name>` (use `@click="router.push(...)"` on `<tr>`). Data via:

```js
import { createResource } from "frappe-ui";
const dash = createResource({
  url: "jms.jms.portal_api.dashboard",
  auto: true,
});
```

Loading state: panels render skeleton text "Loading…" while `dash.loading`; on `dash.error` show the panel-level error with a Retry button calling `dash.reload()`.

- [ ] **Step 4: Build, clear cache, verify by API + eye**

Run the Task 5 Step 6 build/clear block, then:
`SID=... ; curl -s -b "sid=$SID" "http://127.0.0.1:8000/api/method/jms.jms.portal_api.dashboard" | head -c 300`
Expected: JSON starting `{"message":{"kpis":{"total_job_amount":1008412.5...`.

- [ ] **Step 5: Commit**

```bash
git add frontend jms/www/portal.html jms/public/frontend
git commit -m "feat(portal): dashboard page (KPIs, trend chart, feeds)"
```

---

### Task 7: Jobs list page

**Files:**
- Modify: `frontend/src/pages/JobsList.vue`

**Interfaces:**
- Consumes: `portal_api.job_list` (Task 2), `StatusChip`, `fmtMoney`.
- Produces: `/jobs` route with filters + pagination.

- [ ] **Step 1: Implement `JobsList.vue`** — filter bar (status `<select>` with the 9 Job statuses + "All", debounced text search input), table identical in structure to the dashboard's recent-jobs table plus a Date column, footer with `Prev / Page N of M / Next`:

```vue
<template>
  <div class="top">
    <div><h1>Jobs</h1><p class="num">{{ jobs.data?.total ?? "…" }} jobs</p></div>
    <div class="search" style="min-width:280px">
      <input v-model="search" placeholder="Search job, title, customer…"
        style="border:0;background:none;outline:none;color:inherit;flex:1" />
    </div>
    <select v-model="status" class="theme-btn">
      <option value="">All statuses</option>
      <option v-for="s in STATUSES" :key="s" :value="s">{{ s }}</option>
    </select>
  </div>

  <section class="panel">
    <div style="overflow-x:auto">
      <table>
        <thead><tr><th>Job</th><th>Customer</th><th>Agent</th><th>Date</th>
          <th>Status</th><th class="r">Amount</th><th class="r">Outstanding</th></tr></thead>
        <tbody>
          <tr v-for="r in jobs.data?.rows ?? []" :key="r.name"
              @click="router.push(`/jobs/${encodeURIComponent(r.name)}`)">
            <td class="job-id">{{ r.name }}</td>
            <td>{{ r.customer }}</td>
            <td>{{ r.agent || "—" }}</td>
            <td class="num">{{ r.date || "—" }}</td>
            <td><StatusChip :status="r.status" /></td>
            <td class="r num">{{ fmtMoney(r.amount) }}</td>
            <td class="r num" :class="r.outstanding > 0 ? 'o-pend' : 'o-zero'">
              {{ fmtMoney(r.outstanding) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="panel-h" style="border-top:1px solid var(--line-soft);border-bottom:0">
      <button class="theme-btn" :disabled="page === 0" @click="page--">← Prev</button>
      <span class="hint">Page {{ page + 1 }} of {{ pages }}</span>
      <button class="theme-btn" :disabled="page + 1 >= pages" @click="page++">Next →</button>
    </div>
  </section>
</template>

<script setup>
import { ref, watch, computed } from "vue";
import { useRouter } from "vue-router";
import { createResource } from "frappe-ui";
import StatusChip from "../components/StatusChip.vue";
import { fmtMoney } from "../format";

const STATUSES = ["Created", "In Progress", "Processing", "Completed",
  "Rejected", "Cancelled", "Supervisor Approved", "MD Approved", "Closed"];
const PAGE = 20;
const router = useRouter();
const search = ref(""), status = ref(""), page = ref(0);

const jobs = createResource({
  url: "jms.jms.portal_api.job_list",
  makeParams: () => ({
    search: search.value || undefined,
    status: status.value || undefined,
    start: page.value * PAGE,
    page_length: PAGE,
  }),
  auto: true,
});
const pages = computed(() => Math.max(1, Math.ceil((jobs.data?.total ?? 0) / PAGE)));

let t;
watch(search, () => { clearTimeout(t); t = setTimeout(() => { page.value = 0; jobs.reload(); }, 300); });
watch(status, () => { page.value = 0; jobs.reload(); });
watch(page, () => jobs.reload());
</script>
```

- [ ] **Step 2: Build + verify** — Task 5 Step 6 build/clear block, then
`curl -s -b "sid=$SID" "http://127.0.0.1:8000/api/method/jms.jms.portal_api.job_list?status=Created&page_length=2"` → JSON rows all `"status":"Created"`.

- [ ] **Step 3: Commit**

```bash
git add frontend jms/www/portal.html jms/public/frontend
git commit -m "feat(portal): jobs list page with filters and pagination"
```

---

### Task 8: Job detail page

**Files:**
- Create: `frontend/src/components/JobStepper.vue`
- Modify: `frontend/src/pages/JobDetail.vue`

**Interfaces:**
- Consumes: `portal_api.job_detail` payload (Task 3).
- Produces: `/jobs/:name` route.

- [ ] **Step 1: `JobStepper.vue`** — renders one stepper row from `{steps, active, dead}`:

```vue
<template>
  <p class="step-title">{{ title }}</p>
  <div class="stepper">
    <template v-for="(s, i) in steps" :key="s">
      <div class="stp" :class="stateOf(i)">
        <i>{{ stateOf(i) === 'done' ? '✓' : stateOf(i) === 'active' ? '●' : '○' }}</i>
        <span>{{ s }}</span>
      </div>
      <div v-if="i < steps.length - 1" class="s-arrow">→</div>
    </template>
  </div>
</template>

<script setup>
const props = defineProps({
  title: String,
  steps: Array,
  active: Number,
  dead: { type: Boolean, default: false },
});
const stateOf = (i) => {
  if (props.dead) return "";
  if (i < props.active) return "done";
  if (i === props.active) return "active";
  return "";
};
</script>
```

- [ ] **Step 2: `JobDetail.vue`** — breadcrumb, header (title, meta line `name · customer · Agent: x · date`, "Open in Desk" button `window.open('/app/job/' + name)`), the two steppers (`Lifecycle` and `Work & Money`; when `lifecycle.dead` show a `jp-dead`-style red line "This job is <status>"), tasks table (name / assignee (prefix "Outsource · " when `outsourced`) / due / StatusChip), financial summary list (only visible metrics, `net_profit` in green, `outstanding` amber when > 0), indicator badges (Amount Pending red, Exp. Pending amber, only when `indicators.show`), linked documents grouped in three short lists. Data:

```js
import { createResource } from "frappe-ui";
const props = defineProps({ name: String });
const job = createResource({
  url: "jms.jms.portal_api.job_detail",
  params: { name: props.name },
  auto: true,
});
```

Error state: if `job.error`, render a panel "Job not found or not accessible" with a link back to `/jobs`. No "Close Job" button in Phase 1 (spec: read-only) — the footer note reads "Read-only preview — use Open in Desk for actions."

- [ ] **Step 3: Build + verify** — build/clear block, then
`curl -s -b "sid=$SID" "http://127.0.0.1:8000/api/method/jms.jms.portal_api.job_detail?name=JOB-5519%2F26" | head -c 300` → JSON with `"lifecycle":{"steps":["Created","In Progress"...`.

- [ ] **Step 4: Commit**

```bash
git add frontend jms/www/portal.html jms/public/frontend
git commit -m "feat(portal): job detail page with steppers and financials"
```

---

### Task 9: UI smoke test + final verification + push

**Files:**
- Create: `frontend/smoke/portal_smoke.js`

**Interfaces:**
- Consumes: the running bench, `bench browse --user` sid minting, Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, `playwright-core` (already a devDependency from Task 4).

- [ ] **Step 1: Write the smoke driver**

`frontend/smoke/portal_smoke.js`:

```js
// JMS Portal smoke: login -> dashboard renders real KPIs -> jobs list ->
// job detail steppers render. Usage:
//   SID=$(bench --site oasis.local browse --user Administrator | grep -o 'sid=[a-f0-9]*' | cut -d= -f2)
//   node frontend/smoke/portal_smoke.js "$SID"
const { chromium } = require("playwright-core");
const BASE = "http://127.0.0.1:8000";
const SID = process.argv[2];
const fail = (m) => { console.error("FAIL:", m); process.exit(1); };

(async () => {
  const browser = await chromium.launch({
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    headless: true,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 950 } });
  await page.goto(`${BASE}/app?sid=${SID}`, { waitUntil: "domcontentloaded" });

  await page.goto(`${BASE}/portal`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".kpi .k-value", { timeout: 20000 });
  const kpis = await page.$$eval(".kpi .k-value", (els) => els.map((e) => e.textContent.trim()));
  if (kpis.length < 5 || kpis.every((v) => v === "0.00")) fail("KPIs empty: " + kpis);
  console.log("dashboard KPIs:", kpis.join(" | "));
  await page.screenshot({ path: __dirname + "/smoke_dashboard.png" });

  await page.click('a[href="/portal/jobs"]');
  await page.waitForSelector("tbody tr", { timeout: 15000 });
  const firstJob = await page.$eval("tbody tr .job-id", (e) => e.textContent.trim());
  console.log("jobs list first row:", firstJob);

  await page.click("tbody tr");
  await page.waitForSelector(".stepper", { timeout: 15000 });
  const steppers = await page.$$eval(".stepper", (els) => els.length);
  if (steppers !== 2) fail(`expected 2 steppers, got ${steppers}`);
  const active = await page.$$eval(".stp.active span", (els) => els.map((e) => e.textContent.trim()));
  console.log("job detail active steps:", active);
  await page.screenshot({ path: __dirname + "/smoke_jobdetail.png" });

  await browser.close();
  console.log("PORTAL SMOKE PASS");
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
```

- [ ] **Step 2: Run the smoke**

```bash
cd /Users/sammishthundiyil/frappe-bench-15
SID=$(bench --site oasis.local browse --user Administrator 2>/dev/null | grep -o 'sid=[a-f0-9]*' | cut -d= -f2)
node apps/jms/frontend/smoke/portal_smoke.js "$SID"
```
Expected: `PORTAL SMOKE PASS`, two screenshots written. **Open both screenshots and look at them** — layout, sidebar, chart, steppers.

- [ ] **Step 3: Full regression** — backend suites:

```bash
bench --site oasis.local run-tests --module jms.jms.test_portal_api
bench --site oasis.local run-tests --module jms.jms.doctype.job.test_job
```
Expected: `OK` both (9 + 16 tests).

- [ ] **Step 4: Commit and push**

```bash
git add frontend/smoke
git commit -m "test(portal): end-to-end smoke driver for /portal"
git push
```

---

## Self-Review Notes

- Spec coverage: dashboard endpoint/KPIs/trend/feeds (T1, T6), job_list (T2, T7), job_detail + server-side stages (T3, T8), serving + auth gate + deep links (T4), shell/tokens/"soon" nav (T5), error handling (T6 retry, T8 not-found, T4 guest redirect), testing (T1-T3 unit, T9 smoke). Supplier-balance KPI derivation matches spec's get_financials reference.
- Deviations from spec, both agreed in review: OS-theme only in Phase 1 (mockup's manual toggle dropped, YAGNI); dashboard KPI row shows five cards (outsourcing folded into the expenses sub-line) exactly like the approved mockup.
- Type consistency: `dashboard().kpis.job_count` ↔ T6 sub-line; `job_list` param names match T7 `makeParams`; `job_detail` keys match T8 template paths; stepper `{steps, active, dead}` matches T8 component props.
