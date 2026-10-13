# Accounting Change Log

Accounting Change Log records every change made to the accounting side of the
app in plain language, so the client can see who did what to their books and
when. The **Accounting Activity** page shows the log as a live feed. New changes
appear there as soon as they are saved, with no reload.

The **SBM Dashboard** shows the latest 20 entries in a live **Accounting Activity**
panel next to the jobs list, with a **View all** link to the page. The panel is
`frontend/src/components/AccountingFeed.vue` and is hidden for users who cannot
read the log. After changing it, run `yarn build` in the app folder (the build
output in `jms/public/dashboard` is not in git).

Its companions are [Updated Document](UPDATED_DOCUMENT.md) (every field change
on every doctype, for admins) and [Cancelled Document](CANCELLED_DOCUMENT.md).

## What gets logged

One entry per action, for these documents:

- **Transactions:** Sales Invoice, Purchase Invoice, Payment Entry, Journal Entry,
  Payment Request, Period Closing Voucher.
- **Masters:** Account, Cost Center, Bank Account, Mode of Payment, Fiscal Year,
  Sales / Purchase Taxes and Charges Template.
- **Job, only when money changes:** its amount fields (Discount, Net Amount,
  Agent Commission, ...) or anything in its Items table (Service Charge, Gov Fee,
  Extra, ...). Other Job edits, such as the title or the tasks, are not logged here.

| Action | When |
| --- | --- |
| Created | A new record is saved for the first time. |
| Amended | A cancelled record is amended (the summary names the record it replaces). |
| Edited | An existing draft or master is saved with changes. |
| Submitted | A record is submitted. |
| Edited after Submit | An allowed field is changed on a submitted record. |
| Cancelled | A submitted record is cancelled. |
| Deleted | A record is deleted. The entry stays after the record is gone. |

The lists are `ACCOUNTING_DOCTYPES` and `MONEY_ONLY_DOCTYPES` in
`jms/accounting_log.py`.

### What an entry looks like

> **Rahul edited Sales Invoice SI-00203 for Shoukath Ali Khan Patan**   250.00
> - Grand Total: 100.00 → 250.00
> - Quantity (Items row 1 – Govt fee (200.00)): 1 → 2
> - Items: added Govt fee (50.00)

Field labels are used instead of field names, and amounts and dates are formatted
the way the desk shows them. Values that only change as a side effect of the edit
are left out so the real change is easy to see: company-currency copies
(`base_*`), "In Words", Net Total, Outstanding Amount, Posting Time, the Payment
Schedule, and similar (`NOISE_FIELDS` / `NOISE_TABLES`). Saving without a change
logs nothing.

## What an entry contains

| Field | Meaning |
| --- | --- |
| Action | One of the actions above. |
| Document Type / Document | The record. |
| Summary | The sentence shown in the feed. |
| Changes | One line per changed field, for edits. |
| Party / Amount | Customer, supplier or party, and the document total. |
| Document Date | The posting date of the record. |
| Changed By / Changed By Name | Who did it. |
| Company, Job | Where the record belongs. |

All fields are read-only and nobody can add or change an entry by hand.

## Who can see it

**System Manager**, **Admin**, **Accounts Manager** and **Auditor**, with read
access only. The same roles can open the Accounting Activity page. To show the
log to the client, give the client's user one of these roles; **Auditor** gives
read access without the right to change accounts.

Live updates are only sent to users who can read the log: Frappe checks read
permission before a browser joins the log's realtime room.

## Things to know

- Changes made directly in the database or with `frappe.db.set_value` /
  `db_set` are not logged, only changes made by saving a document. ERPNext itself
  updates some values this way (for example the outstanding amount of an invoice
  when a payment is made), and the Payment Entry that caused it is logged instead.
- A change that fails and is rolled back is not logged, and nothing is sent to
  the feed.
- Nothing is logged during install, migrate or patches.
- If writing an entry fails, the change itself still goes through and the failure
  is written to the Error Log.

## How it works

- The doctype is `jms/jms/doctype/accounting_change_log/`, the page is
  `jms/jms/page/accounting_activity/`.
- `log_accounting_change` in `jms/accounting_log.py` writes the entries. It is
  registered for all doctypes in `jms/hooks.py` under `doc_events` with `"*"`
  (`after_insert`, `on_update`, `on_submit`, `on_update_after_submit`,
  `on_cancel`, `on_trash`) and ignores everything outside the lists above.
- After the change is committed, each new entry is pushed with
  `frappe.publish_realtime("accounting_change_log", ..., doctype="Accounting Change Log")`.
  The page subscribes to that doctype room and adds the entry to the top of the
  feed if it matches the filters.
- `ignore_links_on_delete` in `hooks.py` lets a record be deleted although log
  entries point to it.
- Patch `v1_13.add_accounting_activity_shortcut` adds the page to the SBM workspace.
- Tests are in `jms/jms/doctype/accounting_change_log/test_accounting_change_log.py`.

## How to check it

1. Open **Accounting Activity** from the SBM workspace in one browser tab.
2. In another tab, change the rate of a draft Sales Invoice and save. An
   "edited" entry appears at the top of the feed within a second, without a
   reload, listing the rate and Grand Total change.
3. Submit and then cancel the invoice. "submitted" and "cancelled" entries appear.
4. Change the Service Charge of a Job item. An entry appears. Change only the
   Job title. No entry appears.
5. Log in as a user without one of the roles above. The page and the list are
   not available.
