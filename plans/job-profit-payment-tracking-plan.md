# Implementation Plan — Job Profit & Payment Tracking (JMS)

**App:** `/Users/sammishthundiyil/frappe-bench-kenz/apps/jms`
**Sites:** `service.kenzcloudx.com` (test — build & verify here first), `oasis.kenzcloudx.com` (prod — deploy last)
**Frappe/ERPNext:** v15

## Locked product decisions
- Profit is calculated **EX-VAT** (VAT is pass-through; tax accounts are Liabilities and are excluded automatically).
- **Agent Commission is EXCLUDED** from Net Profit. `Net Profit = Job Amount − Expenses − Outsourcing`.
- **Every metric is optional/configurable** via a new `JMS Settings` single doctype (toggle which of the 8 metrics show on the form and in the report).
- The **Accounting Dimension "Job"** (`fieldname = job`) is the source of truth. It already tags GL Entries (verified live: 106 jobs, Income cr 18,013.50 / Expense dr 36,331.00 / 723 Asset / 154 Liability entries).

## The 8 metrics and their authoritative source
| # | Metric | Source (per `job`) |
|---|--------|--------------------|
| 1 | Total Job Amount | GL: Σ(credit − debit) on **Income** root_type accounts |
| 2 | Total Amount Received | Payment Entry (payment_type=Receive) allocated to the job |
| 3 | Outstanding to Receive | Σ `Sales Invoice.outstanding_amount` where `si.job = job` |
| 4 | Total Expenses | GL: Σ(debit − credit) on **Expense** accounts **excluding** the Outsourcing Cost account |
| 5 | Outsourcing Costs | GL: Σ(debit − credit) on the dedicated **Outsourcing Cost** account |
| 6 | Net Profit | #1 − #4 − #5 |
| 7 | Profit Balance | Received − Expenses Paid − Outsourcing Paid (realized cash profit; Paid from Payment Entry pay-side allocations) |
| 8 | Job Status | `Job.status` + derived **Amount Pending** (#3 > 0) / **Exp. Pending** (unpaid expense/outsourcing payables > 0) indicators |

---

## Phase 0 — Documentation Discovery (DONE — consolidated)

### Allowed APIs (verified, copy from these)
- **Script Report shell** — copy from `jms/jms/jms/report/job_gross_profit/job_gross_profit.py:1-7`:
  ```python
  import frappe
  def execute(filters=None):
      columns = get_columns()
      data = get_data(filters)
      return columns, data
  ```
- **Accounting-dimension helpers** — `from erpnext.accounts.doctype.accounting_dimension.accounting_dimension import get_accounting_dimensions, get_dimension_with_children` (`accounting_dimension.py:244-285`).
- **GL Entry → Account join for root_type** — pattern from `erpnext/accounts/report/trial_balance/trial_balance.py:84-91`:
  ```sql
  SELECT acc.root_type, acc.report_type, SUM(gle.debit) dr, SUM(gle.credit) cr
  FROM `tabGL Entry` gle
  JOIN `tabAccount` acc ON acc.name = gle.account
  WHERE gle.company=%(company)s AND gle.is_cancelled=0 AND gle.job=%(job)s
  GROUP BY acc.root_type
  ```
- **Whitelisted instance method** — copy shape from `job.py:1860-1961` (`create_advance_receipt`). All `create_*` are `@frappe.whitelist()` **instance methods** on the Job class; return value becomes `r.message`.
- **Button + frappe.call from form** — copy shape from `job.js:292-418`. Call style: `frappe.call({ doc: frm.doc, method: "get_financials", args:{...}, callback(r){...} })` (implicit dotted path; method resolves on the doc's controller).
- **Tab Break / Section Break / HTML field JSON** — copy shapes from `job.json`: `financial_tab` Tab Break (`:543-546`), section break (`:322-325`), HTML field `financial_details` (`:548-551`) and `message` (`:469-472`).
- **Outstanding** — `Sales Invoice.outstanding_amount` is canonical and reliable per invoice; SI carries `job` (Link dimension) + legacy `custom_job` (Data).
- **Received / Paid** — `Payment Entry.total_allocated_amount` and `Payment Entry Reference.allocated_amount` (existing reports use these).

### Confirmed facts (do NOT re-derive)
- `tabGL Entry.job` column **exists and is populated** (Accounting Dimension created it at runtime). **Do NOT add a custom `job` field to GL Entry** — query the existing column directly.
- `Job` doctype already has a **Financial tab** (`financial_tab`) and an **HTML field `financial_details`** — render into these.
- The 3 existing reports (`job_gross_profit`, `job_collection_report`, `job_supplier_payment_report`) already join via `Sales Invoice.job` and `Job Task.purchase_invoice`. They will be **superseded** (not deleted) by the new report.
- No `issingle` doctype exists in JMS yet.
- `hooks.py` `doc_events`, `scheduler_events`, `override_doctype_class` are all **commented out**; `fixtures` (Custom Field + Property Setter) are active.

### Anti-patterns to guard against
- ❌ Adding a custom `job`/`custom_job` field to GL Entry (the dimension column already exists).
- ❌ Summing `Job.gross_amount`/`net_amount` as "received/profit" — those are *quoted* amounts, not ledger-realized. Use GL + Payment Entry.
- ❌ Including VAT/tax accounts in profit (filter to root_type Income/Expense only).
- ❌ Inventing `frappe.db.get_job_balance` or similar — no such API. Use raw `frappe.db.sql` like existing reports.
- ❌ Hardcoding company or account names (multi-company; per CLAUDE.md). Resolve accounts per `Job.company`.

---

## Phase 1 — Accounting foundation: split Outsourcing from Expenses + dimension mandatory-flag decision

**Goal:** Make GL cleanly separate metric #4 (Expenses) from #5 (Outsourcing), and resolve the over-strict dimension mandatory flags.

**DB findings (oasis.local, confirmed):** single company **Oasis** (SAR). Expense group parents: `5000 - Expenses - O`, `5100 - Direct Expenses - O`, `5110 - Stock Expenses - O`, `5200 - Indirect Expenses - O`. No outsourcing account exists. **All 5 current job-linked Purchase Invoices post to `5111 - Cost of Goods Sold - O`** — outsourcing and expenses are NOT separated today.

**What to implement:**
1. **Dedicated "Outsourcing Cost" expense account** per company. Add a setup helper (idempotent) that, for each company, creates ledger `Outsourcing Cost` (`is_group=0`, `root_type="Expense"`) under **`5100 - Direct Expenses`** (decision: outsourcing is a direct cost of delivering the job). Suggested code `5120`. Model it like ERPNext account creation (`frappe.get_doc({"doctype":"Account", ...})`). Do NOT hardcode the account name string elsewhere — store the resulting account in `JMS Settings` (Phase 2).
2. **Route outsourcing PIs to that account.** In `job.py` `create_pinvoice` (the outsourcing Purchase Invoice flow), set the PI item's `expense_account` (or the item's income/expense default) to the company's Outsourcing Cost account, so outsourcing debits land there and general expense PIs (`create_expense`) keep landing on their own expense accounts. Copy the existing PI-build block; only add the `expense_account` assignment on the item row.
3. **Dimension mandatory flags.** Both "Mandatory For Balance Sheet" and "Mandatory For Profit and Loss Account" are ON for the `Job` dimension → this can block non-job postings (salaries, rent, overhead). Decision to implement: **turn OFF "Mandatory For Balance Sheet"** and keep P&L mandatory, OR create a **"General / Overhead" Job** to absorb non-job postings. Default recommendation: turn off Balance-Sheet-mandatory (less operational friction) — confirm with user before applying on prod.

**Documentation references:** `job.py:1018-1381` (`create_pinvoice`); ERPNext Account doctype fields; Accounting Dimension form (the screenshot row, company "Oasis").

**Verification checklist:**
- [ ] `frappe.db.exists("Account", {"account_name":"Outsourcing Cost","company":<company>})` is truthy for each active company.
- [ ] Create one test outsourcing PI + one test expense PI on `service.kenzcloudx.com`; query GL grouped by account for that job — outsourcing debit sits on Outsourcing Cost, expense debit on a different expense account.
- [ ] Post a non-job overhead Journal Entry succeeds after the mandatory-flag change (or is correctly absorbed by the General/Overhead job).

**Anti-pattern guards:** no hardcoded account names in queries; account lookups keyed by `(account_name|account_type, company)`.

---

## Phase 2 — `JMS Settings` single doctype (the "optional metrics" requirement)

**Goal:** One config surface so every metric is optional and accounting wiring is not hardcoded.

**What to implement:**
1. New DocType `JMS Settings`, `issingle: 1`, `module: Jms`. Fields:
   - Section "Profit Tracking — Visible Metrics": `show_total_job_amount`, `show_total_received`, `show_outstanding`, `show_total_expenses`, `show_outsourcing_cost`, `show_net_profit`, `show_profit_balance`, `show_status_indicators` — all `Check`, default `1`.
   - Section "Accounting": `outsourcing_cost_account` (Link → Account), `default_company` (Link → Company, optional).
   - Section "Status": `enable_amount_pending_indicator` (Check, default 1), `enable_exp_pending_indicator` (Check, default 1).
2. Provide a single accessor used everywhere: read via `frappe.get_cached_doc("JMS Settings")`.

**Documentation references:** any ERPNext single (e.g. `Accounts Settings`) for `issingle` JSON shape; JMS doctype JSON conventions (Title Case name, snake_case fieldnames — per CLAUDE.md).

**Verification checklist:**
- [ ] `bench --site service.kenzcloudx.com migrate` installs the single; the form opens at `/app/jms-settings`.
- [ ] `frappe.get_cached_doc("JMS Settings").show_net_profit == 1` by default.

**Anti-pattern guards:** no per-site hardcoding; account/company links resolved from this doctype.

---

## Phase 3 — Backend: `get_financials()` whitelisted method on Job

**Goal:** One server method returns all (enabled) metrics for a job, computed from GL + Payment Entry + SI outstanding.

**What to implement (instance method on Job class in `job.py`, decorated `@frappe.whitelist()`):**
- Resolve `company = self.company`, `outsourcing_acct = JMS Settings.outsourcing_cost_account`.
- **#1 Total Job Amount (ex-VAT):** GL Σ(credit−debit) on accounts where `root_type='Income'` and `gle.job=self.name`.
- **#4 Total Expenses:** GL Σ(debit−credit) on `root_type='Expense'` accounts **excluding** `outsourcing_acct`, `gle.job=self.name`.
- **#5 Outsourcing Costs:** GL Σ(debit−credit) on `account = outsourcing_acct`, `gle.job=self.name`.
- **#6 Net Profit:** `#1 − #4 − #5`.
- **#2 Total Received:** Σ `Payment Entry` allocations where `payment_type='Receive'` and `job=self.name` (use Payment Entry Reference allocated_amount; mirror `job_collection_report.py`).
- **#3 Outstanding:** Σ `Sales Invoice.outstanding_amount` where `si.job=self.name` and `docstatus=1`.
- **#7 Profit Balance:** `Received − ExpensesPaid − OutsourcingPaid`, where paid = Σ Payment Entry (payment_type='Pay') allocations against expense PIs / outsourcing PIs for the job.
- **Customer-vs-Agent split** of #2 (HIGH relevance — DB shows 177 Agent jobs vs 24 Customer; agents pay via their linked Customer so `party_type` is always "Customer" and CANNOT be used). Derive by comparing each received Payment Entry's `party`: party == `self.agent_customer` → "from Agent"; party == `self.customer` → "from Customer". Return `received_from_customer`, `received_from_agent`, and a simple `received_from` label (from `self.receivable_from`) for the form.
- **Status indicators:** `amount_pending = #3 > 0`; `exp_pending = unpaid expense/outsourcing payables > 0` (Σ PI.outstanding_amount for job).
- Read `JMS Settings`; only compute/return metrics whose `show_*` is enabled. Return a dict `{metric_key: {label, value, currency, visible}}` plus indicators.

**Documentation references:** `job.py:1860-1961` (whitelist instance-method shape); `job_collection_report.py:125-157` and `job_supplier_payment_report.py:112-143` (PE/PI allocation joins); `trial_balance.py:84-91` (account-type join).

**Verification checklist:**
- [ ] Pick one job already tagged in GL on `service`. Run `bench --site service.kenzcloudx.com execute jms.jms.doctype.job.job.<get_financials helper>` (or a small console script instantiating the doc) and **reconcile Net Profit against ERPNext's Profit and Loss Statement filtered by that Job dimension** — they must match.
- [ ] Reconcile #3 against the `job_collection_report` for the same job.
- [ ] Disable `show_net_profit` in JMS Settings → method omits/marks it not-visible.

**Anti-pattern guards:** parameterized SQL (`%(job)s`, `%(company)s`); `is_cancelled=0` on GL; `docstatus=1` on vouchers; never sum quoted `Job` fields for realized figures.

---

## Phase 4 — Frontend: render the Financials summary on the Job form

**Goal:** Opening a job shows the enabled metrics in a clear card, in the existing Financial tab.

**What to implement:**
- In `job.js` `refresh(frm)`: if `!frm.is_new()`, `frappe.call({ doc: frm.doc, method: "get_financials", callback(r){ render(r.message) } })`.
- `render()` writes HTML into the existing `financial_details` HTML field (`frm.fields_dict.financial_details.$wrapper.html(...)`). Layout: a compact summary card; only render metrics with `visible=true`. Show **Amount Pending** (red) / **Exp. Pending** (orange) badges when set.
- Palette per user prefs: **dark green / dark gold / cream** — no blue gradients, no generic card-grid; use a simple labeled key→value list with accent left-border.
- Optional: add a "Recalculate" custom button that re-calls `get_financials` (no stored fields to sync — always live).

**Documentation references:** `job.js:55-1712` (refresh handler + `add_custom_button`); `job.json:548-551` (`financial_details` HTML field).

**Verification checklist:**
- [ ] Open a tagged job on `service` → all enabled metrics show with correct numbers (match Phase 3).
- [ ] Toggle a `show_*` off in JMS Settings, reload job → that metric disappears.
- [ ] A job with an unpaid SI shows the **Amount Pending** badge.

**Anti-pattern guards:** use `frappe.call` not raw fetch (CLAUDE.md); format currency via `format_currency`/`frappe.format` with the company currency (multi-currency aware).

---

## Phase 5 — `Job Profitability` Script Report (supersedes 3 reports)

**Goal:** One report: rows = jobs, columns = the 8 metrics.

**What to implement:**
- New report folder `jms/jms/jms/report/job_profitability/` with `.py`, `.json` (`report_type:"Script Report"`, `ref_doctype:"Job"`, `is_standard:"Yes"`), `.js` (filters).
- Filters: date range (`Job.date`), company, customer, agent, status.
- `get_data`: one GL query grouped by `gle.job` joined to Account (root_type), LEFT JOINed to per-job SI outstanding and PE received/paid subqueries (mirror existing report subquery style). Compute the 8 columns in Python.
- Column visibility respects `JMS Settings.show_*` (omit hidden columns).
- Add a header note / mark the old 3 reports as superseded in their `.js` (`frappe.msgprint` deprecation hint) — **do not delete** until sign-off.

**Documentation references:** `job_gross_profit.py:67-148` (subquery join shape), `job_collection_report.py:125-157`, `trial_balance.py:84-91` (account join).

**Verification checklist:**
- [ ] Report row numbers for 3 sample jobs equal their on-form `get_financials` values.
- [ ] Total column sums reconcile against ERPNext P&L filtered by Job dimension (aggregate).
- [ ] Toggling a `show_*` hides the corresponding column.

**Anti-pattern guards:** paginate-safe (report is aggregate SQL, fine); parameterized filters; no N+1 per-job python queries — one grouped query + subqueries.

---

## Phase 6 — Status redesign (work status + derived financial indicators)

**Goal:** Match the handwritten note: manual work status + auto financial states.

**What to implement:**
- **Work status (manual):** keep `Job.status` but ensure the working set includes Processing / Completed / Cancelled (map legacy values; do not break existing data — keep old options, optionally hide unused ones via Property Setter fixture).
- **Derived indicators (auto):** from Phase 3 `amount_pending` / `exp_pending`. Show as:
  - Form dashboard indicators in `job.js` (`frm.dashboard.add_indicator("Amount Pending","red")`).
  - List-view indicator via `job_list.js` `get_indicator` (or computed field) so the Job list shows Amount/Exp Pending at a glance.
- Gate each indicator behind `JMS Settings.enable_*_indicator`.

**Documentation references:** `job.json` status field options; `job.js` refresh; Frappe `frm.dashboard.add_indicator` / list `get_indicator` patterns.

**Verification checklist:**
- [ ] Job with outstanding > 0 shows red "Amount Pending" on form and list.
- [ ] Job with unpaid payable shows orange "Exp. Pending".
- [ ] Fully-settled job shows neither.

**Anti-pattern guards:** indicators derived, never hand-set; respect settings toggles.

---

## Phase 7 — Standardize on `job` dimension; deprecate legacy `custom_job`

**Goal:** Single source field; remove ambiguity.

**What to implement:**
- New code (Phases 3/5) uses the `job` Link dimension exclusively.
- Migrate the 3 legacy reports' references from `custom_job` (Data) to `job` (Link) where they read the data field. (Note: `create_*` already set BOTH `job` and `custom_job` — keep that during transition for back-compat.)
- Mark `custom_job` deprecated in code comments; schedule removal from fixtures after sign-off (separate cleanup, not in this rollout).

**Verification checklist:**
- [ ] `grep -rn "custom_job" apps/jms/jms` — remaining references are only the back-compat setters + fixtures, not new logic.
- [ ] Reports still return identical rows after switching to `job`.

---

## Final Phase — Verification & rollout

1. **Reconciliation gate (must pass before prod):** For 5 representative jobs on `service.kenzcloudx.com`, the form `get_financials`, the `Job Profitability` report, and ERPNext's **Profit and Loss Statement filtered by the Job dimension** all agree on Net Profit (within rounding).
2. **Anti-pattern grep:** no added GL custom field (`grep -n "GL Entry" apps/jms/jms/fixtures/custom_field.json` shows none for `job`); no hardcoded company/account names in new SQL; all new SQL parameterized.
3. **Settings sweep:** toggle each `show_*` off→on, confirm form + report respond.
4. **Deploy:** migrate `service` → full reconcile → then `oasis.kenzcloudx.com`. Run `bench --site <site> migrate && bench --site <site> clear-cache` and reload the Job desk form.
5. Keep the 3 old reports until users confirm the new report covers their needs, then remove in a follow-up.

## Resolved decisions (from user + oasis.local DB)
- ✅ **Dimension flags:** turn OFF "Mandatory For Balance Sheet" on the `Job` dimension; keep P&L mandatory.
- ✅ **Outsourcing Cost account:** new ledger `Outsourcing Cost` under `5100 - Direct Expenses - O` (company Oasis; single-company site).
- ✅ **Customer-vs-Agent split:** surface it — 88% of jobs are Agent-based. Form card shows a "Received From: Agent/Customer" label; the report carries `received_from_customer` / `received_from_agent` columns. Derive by comparing PE `party` to `agent_customer`/`customer` (NOT `party_type`).
