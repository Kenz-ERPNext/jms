# JMS Portal — Phase 1 Design (Dashboard + Job Browsing)

**Date:** 2026-07-22
**Status:** Approved for planning
**Stack:** Vue 3 + Vite + frappe-ui + Tailwind CSS + vue-router (Approach A)
**Site:** oasis.local (frappe-bench-15), Frappe/ERPNext v15

## Why

Staff find the Frappe desk UX disappointing. Management wants a modern portal
(reference: the KENZ Technology dashboard mockup) built as a single-page app.
Long-term goal is a full portal; this spec covers **Phase 1 only**:

- Phase 1 (this spec): app shell + Dashboard + read-only Job browsing.
- Phase 2 (later spec): job actions — Close Job, task completion, Create
  dialogs (Sales Invoice / Purchase Invoice / Expense / Advance Receipt).
- Phase 3 (later spec): job create/edit.
- Phase 4 (later spec): reports & profitability views.

**Users:** internal staff only, using their existing Frappe accounts and roles.
The classic desk remains available (admins, and any workflow the portal does
not cover yet).

## Architecture

```
apps/jms/
  frontend/                  # Vue 3 + Vite + frappe-ui SPA (new)
    src/
      pages/                 # Dashboard.vue, JobsList.vue, JobDetail.vue
      components/            # AppShell, KpiCard, ProfitTrendChart,
                             # RecentPayments, RecentJobsTable, JobStepper,
                             # FinancialSummary
      router.js
      main.js
    vite.config.js           # build output -> ../jms/public/frontend
  jms/
    portal_api.py            # new whitelisted endpoints (see Backend)
    www/portal.py|.html      # serves the built SPA at /portal
```

- Served on the existing site at **`/portal`**; `website_route_rules` in
  `hooks.py` adds a catch-all (`/portal/<path>` → portal page) so vue-router
  history mode works on refresh/deep links.
- **Auth:** reuses the Frappe session cookie. `www/portal.py` redirects guests
  to `/login?redirect-to=/portal`. frappe-ui's resource layer handles CSRF.
- `bench build` builds the SPA (vite build hooked via package.json / frappe
  build system). No separate server, port, or proxy.

## Backend — `jms/jms/portal_api.py`

Purpose-built, permission-checked endpoints; the SPA does not use raw REST
doctype access in Phase 1.

Every endpoint begins with a guard:
`frappe.has_permission("Job", "read", throw=True)`.

1. `dashboard(company=None)` → one payload:
   - `kpis`: total_job_amount, total_received, outstanding, supplier_balance,
     total_expenses, net_profit — first five reuse `dashboard_api.get_totals`
     (GL/Payment-Entry based, ex-VAT); supplier_balance (net payable to
     suppliers) is a new aggregate computed the same way `get_financials`
     derives net_payable, summed across jobs.
   - `profit_trend`: last 6 months of {month, income, expense, net_profit}
     reusing the `job_profitability_trend` dashboard-chart-source logic.
   - `recent_payments`: last 7 days of submitted Payment Entries tagged to a
     job (receive/pay direction, party, job, amount), newest first, max 8.
   - `recent_jobs`: 5 latest jobs with {name, customer, agent, status, amount,
     outstanding}.
2. `job_list(filters=None, start=0, page_length=20)` →
   `{rows, total}` where rows = {name, job_title, customer, agent, status,
   date, gross/net amount, outstanding}. Filters: status, customer, agent,
   free-text search (name/title/customer). Server-side pagination and search.
3. `job_detail(name)` → header fields, `lifecycle_stage` + `work_money_stage`
   (computed server-side with the SAME rules as the desk stepper in job.js:
   lifecycle from status; work/money from tasks completion,
   `has_sales_invoice`, `net_receivable`, `net_payable` via the existing
   `get_financials`), financial metrics (respecting JMS Settings visibility),
   tasks, and linked documents (Sales/Purchase Invoices, Payment Entries).
   Raises 404-style frappe.DoesNotExistError for unknown names.

Stepper stage logic lives server-side so future phases (and desk, if we later
refactor) share one source of truth.

## Frontend

**Design language:** matches the approved mockup — dark-teal sidebar with the
company branding, cream/white content area, KPI cards with colored accent
dots, green/amber/red financial semantics, grouped bar chart
(Income / Expense / Net Profit per month, frappe-charts).

Pages (vue-router):

- `/portal/` **Dashboard** — KPI card row (6 cards), Job Profit Trend grouped
  bars, Recent Payments feed, Recent Jobs table (row click → job detail).
- `/portal/jobs` **Jobs** — filter bar (status select, customer link-search,
  text search), paginated table, row click → detail.
- `/portal/jobs/:name` **Job detail** (read-only) — header (title, customer,
  agent, status chip), Lifecycle + Work & Money stepper, financial summary
  card, tasks table, linked documents list, **"Open in Desk"** button
  (`/app/job/<name>`) for anything Phase 1 cannot do.

Sidebar shows future sections (Invoices & Payments, Reports, Profitability,
Customers & Agents) greyed out with a "soon" badge — visible roadmap, not
clickable.

**State/data:** frappe-ui `createResource` per endpoint; no global store in
Phase 1. Currency formatting from Frappe boot defaults.

## Error handling

- 403/guest → full-page redirect to `/login?redirect-to=<current>`.
- Endpoint failure → toast with message + retry button on the affected panel;
  the rest of the page stays usable.
- Unknown job name → in-app "Job not found" state with link back to Jobs.

## Testing

- **Server:** `test_portal_api.py` in the existing FrappeTestCase style —
  payload shape of all three endpoints, pagination/search behaviour of
  `job_list`, stepper-stage correctness for a known job fixture, and a
  permission-denial test (user without Job read → PermissionError).
- **UI smoke:** extend the existing Playwright/Chrome driver (scratchpad
  `stepper_smoke.js` pattern): login via `bench browse --user` sid →
  `/portal` renders 6 KPI values → open a job from Recent Jobs → stepper and
  financial card render. Run locally before each phase ships.

## Out of scope (Phase 1)

Any mutation (close job, task edits, document creation), customer/agent
logins, global ⌘K search, mobile-first layouts (the SPA is responsive but
optimized for desktop), replacing desk for admins, reports pages.
