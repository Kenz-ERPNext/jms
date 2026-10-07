# Updated Document

Updated Document keeps a log of every change made to an existing record, one row
per changed field, with the old value and the new value. It is a readable version
of Frappe's built-in version history, which stores each save as one block of JSON.
Its companion is [Cancelled Document](CANCELLED_DOCUMENT.md).

## What gets logged

A row is added for each field that changes when an **existing** record is saved.
This applies to **every doctype**.

- Creating a record logs nothing. Saving without a change logs nothing.
- A change inside a child table is logged per row and field, for example
  `tasks › row 2 › status`. Adding or removing a row is logged as
  `tasks › row added` or `tasks › row removed`.
- Password fields are never logged.
- System logs and queues are skipped (Error Log, Version, Comment, Communication,
  Email Queue and similar), and so are Updated Document and Cancelled Document
  themselves. The full list is `UPDATE_LOG_SKIP` in `jms/events.py`.
- Nothing is logged during install, migrate or patches.

### Reason

When a task in a Job is set to **Pending**, the **Pending Reason** of that task is
stored as the **Reason** of that row. Rows for all other changes have no reason.
The Pending Reason itself is entered on the task, see
[ROLES_AND_PERMISSIONS.md](ROLES_AND_PERMISSIONS.md).

## What a row contains

| Field | Meaning |
| --- | --- |
| Updated Doctype / Updated Name | The record that was changed. |
| Job | The Job it belongs to. For a Job it is the Job itself. Empty if there is none. |
| Field Changed | The field, or `table › row n › field` for a child table row. |
| Old Value / New Value | What it was and what it became. |
| Reason | The Pending Reason, only when a Job task was set to Pending. |
| Updated By | The user who made the change. |
| Created On | When the change was made. |

All fields are read-only and nobody can add, change or delete a row by hand.

## Who can see it

**Admin** and **System Manager**, with read access only.

## Things to know

- **The log grows fast.** Because it covers every doctype, one save of a large
  document, such as a Sales Invoice, can add many rows. Rows are never cleaned up
  automatically. If the table gets too large or saves become slow, limit the
  doctypes in `log_updated_document` in `jms/events.py` or add a cleanup.
- Changes made directly in the database or with `frappe.db.set_value` are not
  logged, only changes made by saving a document.
- Records changed before this feature was added are not in the log.

## How it works

- The doctype is `jms/jms/doctype/updated_document/`.
- `log_updated_document` in `jms/events.py` writes the rows. It is registered for
  all doctypes in `jms/hooks.py` under `doc_events` with `"*"`, for `on_update`.
  It uses Frappe's own `get_diff` to find the changes.
- If writing the rows fails, the save still goes through and the failure is
  written to the Error Log.
- Tests are in `jms/jms/doctype/updated_document/test_updated_document.py`.

## How to check it

1. Change a field on any record and save. A row appears with the old and new value.
2. Open a Job, set a task to **Pending**, fill in **Pending Reason** and save. A
   row `tasks › row 1 › status` appears with the reason.
3. Save a record without changing anything. No row appears.
4. Log in as a user without the Admin or System Manager role. The Updated
   Document list is not available.
