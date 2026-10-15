# SBM frontend plan (React + Refine)

This is the plan for a new SBM frontend in React with Refine, using ERPNext as
the backend. It lists the pages, what each page shows, the buttons on each page,
and the work split into **API tasks** (ERPNext / `jms` app) and **Frontend
tasks** (React).

Target versions: Frappe v15, ERPNext v15.

## Contents

1. [Goals and rules](#1-goals-and-rules)
2. [Where it runs](#2-where-it-runs)
3. [How the work is split](#3-how-the-work-is-split)
4. [Pages](#4-pages)
5. [Job action modals](#5-job-action-modals)
6. [API contract](#6-api-contract)
7. [Frontend structure](#7-frontend-structure)
8. [Design tokens](#8-design-tokens)
9. [API tasks](#9-api-tasks)
10. [Frontend tasks](#10-frontend-tasks)
11. [Order of work](#11-order-of-work)
12. [Testing and release](#12-testing-and-release)
13. [Decisions to confirm with the client](#13-decisions-to-confirm-with-the-client)

---

## 1. Goals and rules

### Fewer clicks

- **One "Next step" button on every Job.** The server decides the next step
  (Create Sales Invoice, Receive Payment, Pay Supplier, Close Job) and the page
  shows it as the main button. Other actions sit in an **Actions** menu.
- **Defaults everywhere.** Company, posting date (today), Receivable From
  (Customer), priority (Medium), mode of payment (last one used by this user).
- **Edit in place.** Task status and assignee change directly in the Tasks
  table. No need to open the row or press Save on the whole Job.
- **One modal per action.** Invoice and its payment are done in the same modal.
- **No extra confirmations.** Ask "Are you sure?" only for Close and Cancel.
- **Stay on the page.** After an action, show a short message with a link to the
  created document and refresh the Job. Do not navigate away.
- **Saved filters.** List pages remember the last tab and filters per user.

### Simple and standard

- Only the screens the business needs. Full accounting (GL, tax, company setup)
  stays in the ERPNext desk for the few users with a desk role. Everyone else
  works only in SBM ([section 2](#2-where-it-runs)).
- Same layout on every page: page title, main button on the right, tabs or
  filters, then the content.
- TypeScript `strict`, ESLint, Prettier. Code, file and folder names in English.
- All user-visible text in one place per feature, so Arabic can be added later.

### SOLID in this project

| Principle | How it is applied |
| --- | --- |
| Single responsibility | A component only shows things. Data loading is in hooks. API calls are in the data provider or `services/`. |
| Open/closed | Job actions and master pages are **config entries**. Adding a new action or master means adding one file, not editing existing pages. |
| Liskov substitution | Every action modal takes the same `ActionModalProps`, so the Job page can open any of them the same way. |
| Interface segregation | Small prop types. A component gets only the fields it uses, not the whole Job. |
| Dependency inversion | Pages call Refine hooks (`useList`, `useCustomMutation`), never `fetch` directly. The Frappe details live only in the data provider. |

The same rules apply to the Python API: one module per area, thin
whitelisted functions that call the existing `Job` methods.

### File size

- **Maximum 200 lines per file**, frontend and new backend files.
- Frontend: ESLint rule
  `"max-lines": ["error", { "max": 200, "skipBlankLines": true, "skipComments": true }]`.
- Backend: a CI check that fails if a file under `jms/api/` is over 200 lines.
- If a file grows past 200 lines, split it (a hook, a sub-component, a helper).
- `jms/jms/doctype/job/job.py` is already about 3,000 lines. It is not part of
  this rule now. Splitting it is optional task API-12.

### UI

- Ant Design components with the SBM theme from design tokens
  ([section 8](#8-design-tokens)). No colours, sizes or spacing written directly
  in components.
- Clear and calm: white cards, one accent colour, status colours only for status.
- Works on phone width for the Task Staff pages.

---

## 2. Where it runs

**Yes, the frontend can run on the client's ERPNext site.**

| What | URL |
| --- | --- |
| ERPNext desk (unchanged) | `https://service.kenzcloudx.com/app` |
| Current SBM dashboard (Vue, desk page) | `https://service.kenzcloudx.com/app/jms-dashboard` |
| **New SBM frontend** | `https://service.kenzcloudx.com/sbm` |

How:

- The React build is shipped inside the `jms` app (`jms/public/sbm/`).
- A web page `jms/www/sbm.html` loads it. A route rule in `hooks.py` sends every
  `/sbm/...` path to that page so React handles the routes.
- Users log in with their normal ERPNext user on the SBM login page, shown at
  ERPNext's own login URL (`/login`). The session cookie works because it is the same domain. No
  CORS, no API keys.
- The current Vue dashboard already works the same way (shipped in `jms`,
  served by the same site), so nothing new is needed on the server.

### Client users see only SBM

Building the React app does not hide ERPNext by itself. A user with desk access
can still type `/app`. So:

| What | How |
| --- | --- |
| After login, go to SBM | The login page reloads to `/sbm`. The apps screen tile (`add_to_apps_screen`) opens `/sbm` |
| Block the desk | A `before_request` hook in `jms`: if the path starts with `/app` and the user has none of the **desk roles**, redirect to `/sbm`. `/api/...` is never blocked |
| ERPNext login page | **Done.** `page_renderer` hook (`jms/sbm_login.py`): the URL stays `/login`, but the page is the SBM React login. `/login?desk=1` still opens the ERPNext login as a fallback |
| ERPNext password reset page | `/update-password` → `/sbm/reset-password` (same way), when the React reset page exists |
| Invoices and payments | Shown inside SBM (read-only view + PDF), not by linking to the desk |

**Desk roles** are set in JMS Settings (default: System Manager). Users keep
their normal roles and permissions, so invoice and payment creation works as
today. Do not remove "Desk Access" from roles; ERPNext checks it in places and
that can break document creation.

| User | Sees |
| --- | --- |
| Task Staff, office staff | SBM (`/sbm`) only |
| Accountant / Admin with a desk role | SBM and ERPNext desk |
| Kenz support | Everything |

Deploy on the client server:

```
cd ~/frappe-bench/apps/jms && git pull
cd ~/frappe-bench
bench build --app jms
bench --site <client site> migrate
bench --site <client site> clear-cache
bench restart        # or: sudo supervisorctl restart all
```

**Development must not point at `service.kenzcloudx.com`.** The money actions
create real invoices and payments. Use a local or test site with a copy of the
data.

---

## 3. How the work is split

Two tracks that can run in parallel once the API contract
([section 6](#6-api-contract)) is agreed.

| Track | Who | Where | What |
| --- | --- | --- | --- |
| **API** | Python / Frappe developer | `jms` app | New `jms/api/` package, rules moved from `job.js` to Python, `/sbm` hosting, tests |
| **Frontend** | React developer | `sbm-react/` folder | Refine app, pages, modals, design tokens, frontend tests |

Rules between the tracks:

- The frontend only uses `/api/resource/...` and the functions in
  [section 6](#6-api-contract). Any new need goes into the contract first.
- Until an API function is ready, the frontend uses a mock with the same
  response shape (`src/services/mocks/`).
- Business rules are never written in React. If the frontend needs a rule (which
  buttons to show, the stage, totals), the API returns it.

---

## 4. Pages

Menu by role:

| Menu | Admin / System Manager | Accounts User | Task Staff |
| --- | --- | --- | --- |
| Dashboard | ✓ | ✓ | |
| Jobs | ✓ | ✓ | |
| My Tasks | ✓ | ✓ | ✓ (home page) |
| Task Board | ✓ | | |
| Reports | ✓ | ✓ | |
| Masters | ✓ | ✓ (read, edit own) | |
| Settings, Audit Log | ✓ | | |

### 4.1 Login, logout and password

All built in React with the SBM design. Frappe does the actual login, session
and password handling through its API.

| Page | Fields and buttons | API |
| --- | --- | --- |
| **Login** `/login` (ERPNext's login URL, our page) | Email, Password, **Log in**, link "Forgot password?" | `POST /api/method/login` (`usr`, `pwd`) |
| **Logout** | "Logout" in the user menu (top right) | `POST /api/method/logout`, then go to `/login` |
| **Forgot password** `/sbm/forgot-password` | Email, **Send reset link** | `frappe.core.doctype.user.user.reset_password` (`user`) |
| **Reset password** `/sbm/reset-password?key=…` | New password, Confirm, **Save** | `frappe.core.doctype.user.user.update_password` (`key`, `new_password`) |

Rules:

- **After login, reload the page** (`window.location.href = "/sbm"`). The page
  loaded as Guest has a Guest CSRF token; the reload gets the user's token and
  boot data from `sbm.py`. Without it the first save fails with a CSRF error.
- After the reload: Task Staff land on **My Tasks**, everyone else on **Dashboard**.
- If any API call returns 401 or 403 because the session expired, log out and
  show the login page with "Your session has expired".
- The reset email sent by Frappe links to `/update-password?key=…`. For now that
  is still Frappe's page; it moves to `/sbm/reset-password?key=…` with FE-4b.
- If two-factor login is turned on for the client site, the login page also needs
  the OTP step (response has `verification`). Not needed while it is off.

`authProvider` outline:

```ts
export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    await post("/api/method/login", { usr: email, pwd: password });
    window.location.href = "/sbm";
    return { success: true };
  },
  logout: async () => {
    await post("/api/method/logout");
    return { success: true, redirectTo: "/login" };
  },
  check: async () =>
    boot.user && boot.user !== "Guest"
      ? { authenticated: true }
      : { authenticated: false, redirectTo: "/login" },
  onError: async (error) => (error.status === 401 || error.status === 403 ? { logout: true } : {}),
  getIdentity: async () => ({ id: boot.user, name: boot.full_name }),
  getPermissions: async () => boot.roles,
};
```

### 4.2 Dashboard

Purpose: see what needs attention today and jump there in one click.

| Block | Content | Click goes to |
| --- | --- | --- |
| Pipeline row 1 (Lifecycle) | Created → In Progress → Completed → Closed, with counts | Jobs list with that status |
| Pipeline row 2 (Work & Money) | Processing Work → Invoice Pending → Amount Pending → Exp Pending → Completed, with counts | Jobs list with that tab |
| Money cards | Total Job Amount, Received, Outstanding, Expenses, Outsourcing Cost, Net Profit (only those enabled in JMS Settings) | Matching report |
| List: **To invoice** | Jobs with all tasks done and no Sales Invoice. Columns: Job, Customer, Net Amount | Job page |
| List: **To collect** | Jobs with amount pending. Columns: Job, Customer, Outstanding, Days since invoice | Job page |
| List: **Overdue** | Jobs past expected completion. Columns: Job, Customer, Expected date, Open tasks | Job page |

Buttons: **New Job** (main), company switch (if more than one company).

### 4.3 Jobs list

| | |
| --- | --- |
| Tabs | All · Processing Work · To invoice · Amount Pending · Exp Pending · Overdue · Closed |
| Search | Job number, title, customer name, mobile |
| Filters | Customer, Agent, Job Type, Priority, Date range |
| Columns | Job No, Title, Customer, Job Type, Status (pill), Stage (pill), Tasks done (3/5 bar), Net Amount, Outstanding, Expected Date (red if overdue) |
| Row click | Opens the Job page |
| Buttons | **New Job** (main), Export (CSV of the current list) |
| Paging | 20 rows, server side |

### 4.4 New Job

One page, top to bottom, no tabs.

| Section | Fields |
| --- | --- |
| Customer | Customer (search; **+ New customer** opens a small drawer with name and mobile), Receivable From (default Customer), Agent (only if Job Source needs an agent or Receivable From = Agent) |
| Job | Title, Job Type, Job Nature (filtered by Job Type), Priority (default Medium), Job Source, Start Date (default today) |
| Services | Table: Work Template, Description, Qty, Fee, Extra, Surcharge, VAT %, Total. Choosing a Work Template fills the row. Footer: Gross, VAT, Discount, Net |
| Notes | Notes |

Buttons: **Save** (main; opens the Job page), **Save & New**, Cancel.
Tasks are created by the server on save and shown on the Job page.

### 4.5 Job page

Header (always visible):

- Job No, Title, Status pill, Stage pill, Customer (link), Expected date.
- Two-row stepper (Lifecycle, Work & Money).
- Amount strip: Net Amount · Received · Outstanding · Net Profit.
- Buttons: **Next step** (main, from the API), **Actions ▾** (other allowed
  actions), **Edit**, **Print** (Job Print Format as PDF). Users with a desk
  role also get **Open in ERPNext**.

Tabs:

| Tab | Lists | Buttons |
| --- | --- | --- |
| **Overview** | Job details (read view), Services table, totals | Edit |
| **Tasks** | Tasks table: Task, Type (Employee/Outsource), Assigned To / Supplier, Charge, Due Date, Status, Pending Reason. Status and assignee are edited in place | Add task, Assign selected (bulk), Mark selected Completed |
| **Money** | Financial card (the metrics enabled in JMS Settings). **Linked documents** table: Type (Sales Invoice, Purchase Invoice, Payment Entry), Number, Date, Party, Amount, Outstanding, Status. The number opens a read-only **document drawer** inside SBM (party, date, items, taxes, totals, outstanding, payments) with a **PDF** button | The same money actions as the Actions menu, grouped "Receive" and "Pay" |
| **Documents** | Required documents checklist: Document, Received (tick), Date, Attachment | Add document, Upload |
| **History** | Timeline from Updated Document: who, what changed, old → new, reason | — |

**Actions ▾ menu** (only the ones the API allows are shown):

| Group | Action |
| --- | --- |
| Receive | Advance Receipt · Create Sales Invoice · SI Payment* · Expense Return |
| Pay | Create Purchase Invoice (outsourced tasks) · Outsource Advance Payment · Create Expense · Payment Return |
| Job | Close Job · Cancel Job |

\* SI Payment is broken today (it calls `create_payment`, which does not exist).
See [section 13](#13-decisions-to-confirm-with-the-client).

**Next step** rules (decided by the API, listed here so both tracks agree):

| Job situation | Next step button |
| --- | --- |
| Tasks not all done | Go to Tasks (opens the Tasks tab) |
| Tasks done, no Sales Invoice | Create Sales Invoice |
| Invoiced, amount pending | Receive Payment (Advance Receipt modal, allocated to the open invoice) |
| Collected, outsourced tasks not billed | Create Purchase Invoice |
| Supplier / expense still unpaid | Pay Supplier (Outsource Advance Payment modal, allocated to the open invoice) |
| Everything settled | Close Job |
| Closed or Cancelled | No main button |

### 4.6 My Tasks (Task Staff home)

Built for phones first.

| | |
| --- | --- |
| Tabs | Open · In Progress · Pending · Completed (last 30 days) |
| Card per task | Task name, Job No and title, Customer, Due date (red if overdue), Priority |
| Buttons on a card | **Start** (→ In Progress), **Done** (→ Completed), **Pending** (asks for the reason in a small box), one tap each |
| Filter | Overdue only |

Task Staff never see amounts, invoices or other people's tasks.

### 4.7 Task Board (Admin)

Replaces the current Vue dashboard.

- Cards: count of Jobs per task status.
- Job cards with task counts; search; status filter.
- Open a Job: kanban of its tasks, drag to change status (Pending asks for the
  reason), timeline on the side.

### 4.8 Masters

One generic list page and one generic form, configured per master.

| Master | List columns | Form fields |
| --- | --- | --- |
| Customers | Name, Mobile, Iqama No, Agent | Name, Mobile, Iqama No, Agent, VAT No |
| Agents | Name, Mobile, Commission Type, Rate, Active | Name, Mobile, Email, Linked Customer, Commission Type, Rate, Tax ID, Active |
| Work Templates | Code, Description, Job Type, Fee, VAT %, Active | Code, Description, Job Type, Item, Qty, Fee, Extra, Surcharge, VAT %, Tax Template, single Task **or** Sub-tasks table (Task, Due days) |
| Job Types | Name, Default Days, Active | Name, Description, Default Duration Days, Active |
| Job Natures | Name, Job Type | Name, Job Type, Description |
| Job Sources | Name, Agent Required | Name, Agent Required |
| Outsourced Parties | Name, Mobile, Supplier, Active | Name, Mobile, Email, Linked Supplier, Payment Terms, Default Payment Account, Active |
| Expense Types | Name, Item | Name, Item |

Buttons on each list: **New** (main), search, row click to edit.
Buttons on each form: **Save** (main), Delete (Admin only, with confirm).

### 4.9 Reports

One page: a report picker on the left grouped by topic, filters on top, table
below.

| Group | Reports |
| --- | --- |
| Work | Work In Progress, Pending Tasks, Outsourcing Pending Tasks, Employee Task Report, Job Status Report |
| Money | Cash Collection, Job Collection Report, Outstanding Receivable, Job Supplier Payment Report, Day Business Summary |
| Profit | Job Profitability, Job Gross Profit, Closed Job Profit, Monthly Profit |

Buttons: **Run** is automatic when filters change; **Export** (CSV). A Job
number in a report opens the Job page.

### 4.10 Settings and Audit Log (Admin)

- **Settings:** JMS Settings form (default company, Outsourcing Cost account,
  which money metrics and indicators to show). Button: Save.
- **Audit Log:** two tabs, Updated Documents and Cancelled Documents. Columns:
  Date, User, Document type, Document, Field, Old, New, Reason. Filters: Job,
  User, Date range.

---

## 5. Job action modals

Every modal: fields with defaults filled, **one main button**, a short success
message with a link to the created document, then the Job refreshes.

| Modal | Fields (default) | Creates in ERPNext |
| --- | --- | --- |
| Advance Receipt | Amount (outstanding), Mode of Payment (last used), Posting Date (today), Reference No/Date, Allocate to open invoices (table, pre-filled) | Payment Entry: Receive from Customer |
| Create Sales Invoice | Tax Template (company default), Posting Date (today), Payment: Credit / Pay now, Full / Partial, Amount, Mode of Payment, Reference No/Date. Shows advances that will be applied | Sales Invoice (submitted) + Payment Entry if paying now |
| Expense Return | Supplier, Amount, Mode of Payment, Posting Date | Payment Entry: Receive from Supplier |
| Create Purchase Invoice | Supplier (from outsourced tasks), Tax Template, Posting Date, Payment: Credit / Pay now, Mode of Payment, Reference No/Date. Shows the tasks being billed | One Purchase Invoice per supplier (Outsourcing Cost account) + Payment Entry if paying now |
| Outsource Advance Payment | Per supplier: Amount, Allocate to open invoices; Mode of Payment, Posting Date, Reference No/Date | Payment Entry per supplier: Pay to Supplier |
| Create Expense | Expense Type, Item (from Expense Type), Supplier, Amount, Tax Template, Payment: Credit / Pay now, Mode of Payment, Posting Date, Reference No/Date | **Purchase Invoice** (not Expense Claim) + Payment Entry if paying now |
| Payment Return | Amount, Mode of Payment, Posting Date | Payment Entry: Pay to Customer |
| Close Job | Confirm only | Job status Closed (blocked if tasks open or money not received) |
| Cancel Job | Confirm only | Job status Cancelled (blocked if Completed/Closed or invoice submitted) |

---

## 6. API contract

All paths start with `/api/method/`. All `POST` calls need the
`X-Frappe-CSRF-Token` header. Errors come back as Frappe errors; the data
provider turns them into one readable message.

### Standard Frappe endpoints (no new code)

| Use | Request |
| --- | --- |
| List | `GET /api/resource/<DocType>?fields=…&filters=…&order_by=…&limit_start=…&limit_page_length=…` |
| Count | `GET frappe.client.get_count?doctype=…&filters=…` |
| Read / create / update / delete | `GET` / `POST` / `PUT` / `DELETE /api/resource/<DocType>/<name>` |
| Link search | `GET frappe.desk.search.search_link?doctype=…&txt=…&filters=…` |
| Report | `POST frappe.desk.query_report.run` with `report_name`, `filters` |
| Login / logout | `POST login` (`usr`, `pwd`), `POST logout` |
| Forgot / reset password | `POST frappe.core.doctype.user.user.reset_password` (`user`), `POST frappe.core.doctype.user.user.update_password` (`key`, `new_password`) |
| PDF of a document | `GET frappe.utils.print_format.download_pdf?doctype=…&name=…&format=…` |

### Rule: Frappe standard API first

A new endpoint is written only when the standard API cannot do the job. Today
only **three** are needed.

| Need | Standard API used |
| --- | --- |
| Jobs, masters, settings: read, create, edit, delete | `/api/resource/<DocType>` |
| Close / Cancel a Job | `PUT /api/resource/Job/<name>` with `status` = `Closed` / `Cancelled`. `validate_closing` and `validate_cancelling` still run |
| Task status, Pending Reason, assignee (office and Task Staff) | `PUT /api/resource/Job/<name>` with the full `tasks` table. For Task Staff the server keeps every other change out (`limit_task_staff_to_status`) |
| My Tasks (Task Staff) | `GET /api/resource/Job` with `fields=["name","job_title","customer_name","`tabJob Task`.name as task","`tabJob Task`.task_name","`tabJob Task`.status","`tabJob Task`.due_date"]` and `filters=[["Job Task","assigned_to","in",<boot.employees>]]` |
| Money actions (section 5) | `POST run_doc_method` with `dt="Job"`, `dn`, `method` (from `get_job_state`), `args` (modal values as JSON). The existing Job methods do the work |
| Open invoices / unallocated payments for a modal | `run_doc_method` with `get_job_open_invoices` / `get_job_unallocated_payments` |
| Dropdowns in modals (tax templates, modes of payment, suppliers, expense types) | `/api/resource/<DocType>` with a `company` filter |
| Linked documents on the Money tab | `GET /api/resource/Sales Invoice` (and Purchase Invoice, Payment Entry) with `filters=[["job","=",<job>]]`; one document: `GET /api/resource/Sales Invoice/<name>` |
| Dashboard pipeline and lists | `jms.api.jobs.list_jobs` (`tab_counts` and small pages) and the existing `jms.jms.dashboard_api.card_*` |
| Task Board | existing `jms.api.job_status_counts`, `job_cards`, `update_task_status`, `job_tasks` |

### New endpoints (written)

| Function | Input | Returns |
| --- | --- | --- |
| `jms.api.boot.get_boot` | — | `user`, `full_name`, `roles`, `is_office`, `is_task_staff`, `employees`; office users also get `company`, `currency`, `settings` (JMS Settings flags) |
| `jms.api.job_state.get_job_state` | `job` | `stage`, `next_action`, `actions` (`[{key, method}]`), `financials` (same as `Job.get_financials`). Office users only |
| `jms.api.home.get_dashboard` | `company` | `lifecycle`, `stages` (`[{label, count}]`), `money` (`[{key, value}]`, only what JMS Settings shows), `to_invoice`, `to_collect`, `overdue` (`{total, amount, rows}`, 6 rows). Office users only |
| `jms.api.jobs.list_jobs` | `tab` (a stage, `Overdue`, `Closed`, or empty), `search`, `company`, `customer`, `agent`, `job_type`, `status`, `from_date`, `to_date`, `start`, `page_length` | `{ jobs, total, tab_counts }`. Each job has the list fields plus `stage`, `tasks_total`, `tasks_done`, `to_collect`, `to_pay`, `overdue`. Office users only |

Stages: `Processing Work` → `Invoice Pending` → `Amount Pending` →
`Exp Pending` → `Completed` (or `Cancelled` / `Rejected`). The same rule is used
by the Job form stepper.

Action keys and the Job method each one calls:

| Key | Method |
| --- | --- |
| `advance_receipt` | `create_advance_receipt` |
| `sales_invoice` | `create_invoice` |
| `purchase_invoice` | `create_pinvoice` |
| `outsource_advance` | `create_outsource_advance_payment` |
| `expense` | `create_expense` |
| `expense_return` | `create_expense_return` |
| `payment_return` | `create_payment_return` |
| `close`, `cancel` | none: save the Job with that status |

`next_action` is one of these keys, `tasks` (open the Tasks tab) or `null`.

`get_job_state` example:

```json
{
  "stage": "Invoice Pending",
  "next_action": "sales_invoice",
  "actions": [
    { "key": "advance_receipt", "method": "create_advance_receipt" },
    { "key": "sales_invoice", "method": "create_invoice" },
    { "key": "close", "method": null }
  ],
  "financials": { "currency": "SAR", "metrics": [{ "key": "net_profit", "label": "Net Profit", "value": 1250.0, "visible": true }] }
}
```

Calling a money action:

```
POST /api/method/run_doc_method
dt=Job&dn=JOB-6004/26&method=create_expense&args={"expense_type":"Visa Fee","amount":200,"supplier":"MOI","item_code":"VISA","payment_type":"Payment Now","mode_of_payment":"Cash"}
```

The response `message` is the created document name.

### Server rules the frontend relies on

- Money actions and `get_financials` are for office roles only (`office_only`
  in `job.py`): Administrator, System Manager, Admin, Accounts User, Accounts
  Manager. Task Staff and Customer users get a permission error.
- Saving a Job sets its status from the tasks for every role (all Completed →
  Completed, all In Progress → In Progress), so the frontend never sets it.

---

## 7. Frontend structure

Stack:

| Need | Choice |
| --- | --- |
| Base | React 18.3, TypeScript 5.9 (strict), Vite 7 |
| Framework | Refine 5 (`@refinedev/core`, `@refinedev/antd` 6, `@refinedev/react-router` 2 with React Router 7) |
| UI | Ant Design 5, themed from design tokens (`@refinedev/antd` 6 needs Ant Design 5) |
| Forms | Ant Design Form through Refine's `useForm` / `useModalForm` |
| Drag and drop | dnd-kit (Task Board) |
| Tests | Vitest 3, React Testing Library, Playwright |
| Lint | ESLint 10 with typescript-eslint, Prettier (tabs, width 99, like the rest of the repo) |

Folders (by feature):

```
sbm-react/
  src/
    main.tsx
    App.tsx                    Refine setup: providers, resources, routes
    theme/
      tokens.ts                design tokens (section 8)
      antdTheme.ts             tokens → Ant Design theme
      tokens.css               tokens → CSS variables
    providers/
      dataProvider.ts          Frappe ↔ Refine (getList, getOne, create, update, deleteOne, custom)
      frappeFilters.ts         Refine filters/sorters → Frappe filters/order_by
      authProvider.ts          login, logout, check, getIdentity, getPermissions
      accessControl.ts         role → allowed menus and actions
      errors.ts                Frappe error → readable message
    components/                shared, no business rules
      StatusPill.tsx  MoneyText.tsx  PageHeader.tsx  Stepper.tsx
      LinkSelect.tsx  EmptyState.tsx
    features/
      auth/                    Login.tsx, ForgotPassword.tsx, ResetPassword.tsx
      dashboard/
      jobs/
        list/                  JobsList.tsx, jobsColumns.tsx, jobsTabs.ts
        create/                JobCreate.tsx, ServicesTable.tsx
        show/                  JobShow.tsx, JobHeader.tsx, tabs/*.tsx
        actions/
          registry.ts          action key → { label, group, modal }
          types.ts             ActionModalProps
          AdvanceReceiptModal.tsx ... one file per action
      tasks/                   MyTasks.tsx, TaskCard.tsx, TaskBoard/
      masters/
        config/                one file per master (columns + form fields)
        MasterList.tsx  MasterForm.tsx
      reports/                 ReportsPage.tsx, config/*.ts (filters per report)
      settings/  audit/
    i18n/en.ts                 all labels
```

Action registry (open/closed principle; a new action is one new file plus one
line here):

```ts
export const jobActions: Record<ActionKey, JobAction> = {
  advance_receipt: { label: "Advance Receipt", group: "receive", modal: AdvanceReceiptModal },
  sales_invoice:   { label: "Create Sales Invoice", group: "receive", modal: SalesInvoiceModal },
  expense:         { label: "Create Expense", group: "pay", modal: ExpenseModal },
  // ...
};
```

The Job page shows only `overview.actions` and opens `jobActions[key].modal`.

---

## 8. Design tokens

All visual values live in `src/theme/tokens.ts`. Components use tokens through
the Ant Design theme or CSS variables, never raw values.

```ts
export const tokens = {
  color: {
    primary: "#166848",       // SBM green
    accent: "#B8892B",        // gold, used sparingly
    bg: "#F7F6F2",
    surface: "#FFFFFF",
    border: "#E5E7EB",
    text: "#1F2937",
    textMuted: "#6B7280",
    success: "#16A34A",
    warning: "#D97706",
    danger: "#B42318",
    info: "#2563EB",
  },
  status: {                   // Job and task status pills
    Created: "info", "In Progress": "warning", Completed: "success",
    Closed: "primary", Cancelled: "danger", Pending: "warning", Open: "info",
  },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 6, md: 8, lg: 12 },
  font: { family: "Inter, system-ui, sans-serif", size: { sm: 12, md: 14, lg: 16, xl: 20, xxl: 24 } },
  shadow: { card: "0 1px 2px rgba(16,24,40,.06)" },
} as const;
```

- `antdTheme.ts` maps these to Ant Design (`colorPrimary`, `borderRadius`,
  `fontFamily`, `fontSize`, …) through `ConfigProvider`.
- Components that need a value directly import `tokens` (no raw colours or sizes).
- The colours above come from the current SBM pages. Confirm them with the
  client before Task FE-2.

---

## 9. API tasks

Track: **API** (Python, `jms` app). Every new file is under 200 lines and has
tests in `jms/tests/`.

| Task | What | Status |
| --- | --- | --- |
| **API-1** | `jms/api.py` is now the package `jms/api/` (`dashboard.py`, `timeline.py`). Old paths `jms.api.job_cards` etc. still work. | Done |
| **API-2** | `/sbm` hosting: `jms/www/sbm.html`, `jms/www/sbm.py` (Guests allowed so the React login page loads; sets `window.csrf_token` and `window.boot`), `website_route_rules` in `hooks.py`. Until the frontend is built the page says so. | Done |
| **API-3** | `jms.api.boot.get_boot`. | Done |
| **API-4** | Job status from tasks for every role (`Job.set_status_from_tasks`). | Done |
| **API-5** | Stage, next action, allowed actions: `jms.api.job_state.get_job_state`. | Done |
| **API-6** | Jobs list with stage, money, tabs and paging: `jms.api.jobs.list_jobs` (about 0.2 s for 1,000 jobs). | Done |
| **API-7** | Security: money actions and `get_financials` limited to office roles (the Customer role could call them before; Task Staff could read job money figures). | Done |
| **API-8** | Data fixes agreed with the client ([section 13](#13-decisions-to-confirm-with-the-client)): discount, default task status, unused statuses, SI Payment. | Waiting for client |
| **API-9** | Keep client users in SBM. **Done:** `/login` shows the SBM login (`jms/sbm_login.py`). **To do:** Desk Roles in JMS Settings (default System Manager); `before_request` hook sending `/app...` to `/sbm` for users without a desk role (never touch `/api`, `/assets`, `/files`, `/private`); apps screen tile opens `/sbm`. | Part done |
| **API-10** | Check print permission so `download_pdf` works for office roles on Sales Invoice, Purchase Invoice, Payment Entry and Job. | To do |
| **API-11** | CI: run `jms` tests; fail if a file under `jms/api/` is over 200 lines. | To do |
| **API-12** *(optional)* | Split `job.py` money methods into `jms/jms/doctype/job/actions/*.py`, each under 200 lines. | Later |

Tests: `jms/tests/test_sbm_api.py` (15 tests).

---

## 10. Frontend tasks

Track: **Frontend** (`sbm-react/`). Every file under 200 lines.

| Task | What | Needs |
| --- | --- | --- |
| **FE-1** | **Done.** Project in `sbm-react/`: Vite, TypeScript strict, Refine 5, Ant Design 5, React Router 7, ESLint (`max-lines` 200), Prettier, Vitest. Builds `sbm.js` + `sbm.css` into `jms/public/sbm`; `bench build` runs it. Boot data from `window.boot` (or `get_boot` on the dev server). See `sbm-react/README.md`. | — |
| **FE-2** | **Done.** Design tokens (`src/theme/tokens.ts`) → Ant Design theme; light sider with SBM green; layout with header (company, user menu: Open ERPNext for admin roles, Logout); menu and routes from one config (`src/config/resources.tsx`); role-based menu and page access (`accessControl.ts`); landing page by role (office → Dashboard, Task Staff → My Tasks); placeholder page for every menu item; 404 / 403 pages; phone layout. | FE-1 |
| **FE-3** | **Done.** Frappe data provider (`src/providers/dataProvider.ts`): resource = DocType, id = `name`; `getList` (paging, `reportview.get_count` total, `meta.fields`), `getOne`, `getMany`, `create`, `update`, `deleteOne`, `custom` (Frappe method or `/api/...` path). Filter/sort mapping in `frappeFilters.ts` (all Refine operators Frappe can express; one OR group → `or_filters`). Unit tests plus a read-only live test (`dataProvider.live.test.ts`). | FE-1 |
| **FE-4** | **Done.** Auth provider, Login (at `/login`, replacing the ERPNext login), Forgot password (also from `/login#forgot`), Logout, reload after login, safe `redirect-to` / `to` after login, session-expired handling. Errors show as Refine notifications. | — |
| **FE-4b** | Reset password page (`/sbm/reset-password?key=…`, `update_password` API) and redirect `/update-password` to it. | FE-4 |
| **FE-5** | Shared components: StatusPill, MoneyText, PageHeader, Stepper, LinkSelect, EmptyState. | FE-2 |
| **FE-6** | Masters: generic MasterList and MasterForm, one config file per master (4.8). | FE-3, FE-5 |
| **FE-7** | **Done.** Jobs list (`src/features/jobs/`): tabs with counts (All, Work in progress, Ready to invoice, Waiting for payment, Supplier to pay, Ready to close, Late, Closed — same numbers as the Dashboard), search (job no, title, customer, mobile), filters (Customer, Agent, Job type, Status, Priority, start date range), 20/50/100 a page; all state in the URL. Row opens the ERPNext form until FE-9. Shared `StatusPill`, `LinkSelect`. Export (CSV) not done yet. | — |
| **FE-8** | **Done (as a modal, per client).** One job modal (`src/features/job-form/`) for New Job and for opening a job from the Jobs list or the Dashboard: Job title, Customer, Receivable from (Customer/Agent → Agent), Job type, Job source; Services with the same columns as the ERPNext Job Item table (Code, Description, Job Qty, Service Charge, Old Service Charge, Gov Fee, Extra, VAT, Total; choosing the Code fills the row and adds its tasks; live totals); Tasks (Employee or Outsource with charge, status, pending reason). Choosing a service adds its tasks at once, the same rules as the ERPNext form (`serviceTasks.ts`: sub-tasks or the single task, due date from due days, tasks of a removed service go, hand-made tasks stay, no duplicates; a template status that is not a task status becomes Open); saving closes the modal with a message. Saving keeps table-row fields the modal does not show and sends cleared fields as null. The full job page (`/sbm/jobs/<name>`) stays for payments and actions ("Payments and more"). | — |
| **FE-9** | **Done.** Job page at `/sbm/jobs/<name>` (`src/features/job/`): header (status, stage by plain name, customer, due), **Next** button from `get_job_state`, More actions grouped Money in / Money out / Job, Print, ERPNext (admin roles); lifecycle and work & money steppers; key money figures; tabs Overview (details, services, totals), Tasks (read-only), Money (all metrics + invoices and payments of the job), Documents, History (admin roles). Close and Cancel work (Job saved with that status; server rules apply). Money actions open the ERPNext form until FE-11; task edits come in FE-10. | — |
| **FE-10** | Tasks tab with in-place edits and bulk actions (save with `PUT /api/resource/Job`). | FE-9 |
| **FE-11** | **Done.** Job actions in SBM (`src/features/job-actions/`), no ERPNext: an **Actions** button on every Jobs list row (and the job page): Edit job, the ERPNext **Create** menu with the same names, order and show conditions (`get_actions` in `jms/api/job_state.py`: Outsource Advance Payment, Advance Receipt, Payment Return, Create Sales Invoice, Create Expense, Expense Return, Create Purchase Invoice), then Close Job and Cancel. Same dialog titles, buttons, field labels and messages ("Sales Invoice already created for this Job.", "No unbilled outsource tasks found..."); each calls the same Job method via `run_doc_method`. SI Payment left out: it calls `create_payment`, which does not exist. | — |
| **FE-12** | **Done.** My Tasks (`src/features/my-tasks/`), Task Staff home, phone first: tabs Open / In Progress / Pending / Completed (last 30 days) with counts, Late only switch, a card per task (task, job, customer, due, priority) with one-tap Start / Done / Pending (asks the reason) / Reopen. API `jms/api/tasks.py`: `my_tasks` (tasks of the user's Employee) and `set_task_status` (one task; the Job is saved so all its rules run; Task Staff only their own tasks; not on Closed/Cancelled jobs). A user without an Employee gets a message to ask the admin. | — |
| **FE-13** | **Done.** Dashboard (`src/features/dashboard/`), by importance: 4 money KPIs (Net Profit card also shows expenses and outsourcing); Needs action: 3 tiles (Ready to invoice, Waiting for payment, Late jobs) with count and amount, the chosen tile's 6 jobs in one table, View all → Jobs tab; Job pipeline card: open jobs per stage as bars, status chips; money cards with icons; two 6-month bar charts (money received, new jobs) from `jms/api/trends.py`, plain SVG-free bars (`src/components/BarChart.tsx`, no chart library) in colour token `chart` (#1F8A55, passes the dataviz palette checks), tooltip per bar. One call: `jms.api.home.get_dashboard`. Job links open the ERPNext form until FE-9; New Job opens the ERPNext form until FE-8. | — |
| **FE-14** | Task Board (4.7), using the existing dashboard API. | FE-5 |
| **FE-15** | Reports page (4.9): picker, filters per report from config, table, CSV export. | FE-5 |
| **FE-16** | Settings and Audit Log (4.10). | FE-6 |
| **FE-17** | Playwright tests for the main flows (section 12), production build, deploy to the test site. | All above |
| **FE-18** | Document drawer on the Money tab (Sales Invoice, Purchase Invoice, Payment Entry: read-only) and PDF buttons (document drawer and Job Print). "Open in ERPNext" only for desk roles. | FE-9, API-10 |

---

## 11. Order of work

### Before Task 1 (week 0)

1. Send the questions in [section 13](#13-decisions-to-confirm-with-the-client)
   to the client and get answers. They change API-8, API-9 and the design tokens.
2. Get a **test site** with a copy of the client data (backup of
   `service.kenzcloudx.com` restored on a test bench). Never develop against the
   live site.
3. Check on the test site: the Accounting Dimension "Job" exists, JMS Settings
   has the default company and Outsourcing Cost account, two-factor login on or off.
4. Create a git branch `feature/sbm-react` from `main`. API and frontend work
   go in it as small pull requests, one task per pull request.
5. Both developers read sections 4 to 6 and agree the API contract. Changes to
   the contract after this are written in section 6 first.

### Blocks

```
Done           API-1, API-2, API-3, API-4, API-5, API-6, API-7
Done           FE-1, FE-2, FE-3, FE-4, FE-7, FE-8, FE-9, FE-11, FE-12, FE-13
Week block 1                                     FE-5, FE-6
Week block 2   API-10, API-11                    FE-4, FE-6, FE-7
Week block 3   API-8 (after client answers)      FE-8, FE-9, FE-10
Week block 4                                     FE-11, FE-12, FE-18
Week block 5   API-9 (API-12 optional)           FE-13, FE-14, FE-15, FE-16
Week block 6   Fixes from testing                FE-17, client testing on test site
Release        Deploy to service.kenzcloudx.com/sbm; desk stays available
```

Agree the decisions in section 13 and the API contract in section 6 before
block 1 ends.

---

## 12. Testing and release

End-to-end flows to test on the test site (Playwright, plus a manual check in
ERPNext):

1. Create a Job with a Work Template that has sub-tasks; the tasks appear.
2. Task Staff: Pending without a reason is blocked; with a reason it saves; they
   cannot see other Jobs.
3. Advance Receipt, then Create Sales Invoice: the advance is applied.
4. Create Purchase Invoice for outsourced tasks; Create Expense with Pay now.
5. Close with money still owed is blocked; collect the balance; Close works and
   `closing_date` is set.
6. Cancel the Sales Invoice in ERPNext: the Job goes back to Completed and the
   Next step changes.
7. The Money tab totals match the Job Profitability report.

Release:

1. Run on the test site with the client for at least one week, desk and `/sbm`
   side by side.
2. After sign-off, deploy to `service.kenzcloudx.com` (section 2).
3. Turn on the desk block (API-9) only after the client has signed off, and
   set the Desk Roles in JMS Settings. Until then everyone can still use the
   desk as a fallback.
4. Tell users the new address: `https://service.kenzcloudx.com/sbm`. The old
   `/login` address also works, because it redirects to the SBM login.

---

## 13. Decisions to confirm with the client

| Topic | Today | Question |
| --- | --- | --- |
| SI Payment | Button calls `create_payment`, which does not exist, so it fails | Remove it (Advance Receipt already pays open invoices) or build it? |
| Discount | `balance` subtracts the discount; the Sales Invoice and the Close rule do not | Should the discount reduce the invoice? |
| Default task status | Tasks from templates start as Pending with no reason | Start as Open instead? |
| Unused statuses | Processing, Supervisor Approved, MD Approved, Rejected are options but nothing sets them; `jms/jms/workflow/job_workflow.json` is not loaded | Remove them, or is an approval flow needed? |
| Desk access | Everyone with a desk role can open ERPNext | Who still needs the ERPNext desk (accountant, admin)? Everyone else sees only SBM. If nobody may use the desk, the accounts screens they use must also be built in SBM, which adds a lot of work |
| Two-factor login | Not checked | Is it on for the client site? If yes, the SBM login needs the OTP step |
| Language | English | Arabic and right-to-left needed? |
| Phones | Desk only | Task Staff on phones? (Plan assumes yes.) |
| Colours and logo | Current SBM green and gold | Confirm brand colours |
| Vue dashboard | `/app/jms-dashboard` | Remove after the React Task Board is live? |
