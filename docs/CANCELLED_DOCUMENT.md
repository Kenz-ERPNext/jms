# Cancelled Document

Cancelled Document keeps a copy of every record that is cancelled. It is the
cancel-side twin of Frappe's built-in **Deleted Document**, which keeps a copy of
every record that is deleted.

## What gets logged

A row is added when either of these happens, for any doctype:

1. A submitted record is **cancelled**: Sales Invoice, Purchase Invoice, Payment
   Entry, Journal Entry and so on.
2. A record that is not submittable gets its **Status set to Cancelled**: for
   example a Job or a Task.

A record whose status is already Cancelled does not get a second row when it is
saved again. A change to any other status is not logged.

Cancelling a task row inside a Job does not log anything on its own. The log
only happens when the Job's own status becomes Cancelled.

## What a row contains

| Field | Meaning |
| --- | --- |
| Cancelled Doctype | The type of the record, for example Sales Invoice. |
| Cancelled Name | The name of the record, for example SI-00175. |
| Job | The Job the record belongs to. For a Job it is the Job itself. Empty if there is none. |
| Data | A full JSON copy of the record at the time it was cancelled. |
| Cancelled By | The user who cancelled it. |
| Created On | When it was cancelled. |

All fields are read-only and nobody can add, change or delete a row by hand.

## Who can see it

**Admin** and **System Manager** can open the Cancelled Document list, with read
access only. Nobody else can see it. See
[ROLES_AND_PERMISSIONS.md](ROLES_AND_PERMISSIONS.md) for the roles.

Rows are never cleaned up automatically.

## Differences from Deleted Document

- A cancelled record is not removed, it stays in the database with
  `docstatus = 2`. This log is a list of what was cancelled, not a way to get
  the record back. To redo a cancelled record, use **Amend** on the original.
- There is no reason field, only who and when.
- Records cancelled before this feature was added are not in the log.

## How it works

- The doctype is `jms/jms/doctype/cancelled_document/`.
- The function `log_cancelled_document` in `jms/events.py` writes the row. It is
  registered for all doctypes in `jms/hooks.py` under `doc_events` with `"*"`, for
  `on_cancel` and `on_update`.
- If writing the row fails, the cancel still goes through and the failure is
  written to the Error Log.
- Tests are in `jms/jms/doctype/cancelled_document/test_cancelled_document.py`.

## How to check it

1. Open a submitted Sales Invoice and cancel it. A row for it appears in the
   Cancelled Document list, with its Job if it had one.
2. Set a Job's status to Cancelled and save. A row for the Job appears.
3. Save the Job again. No second row appears.
4. Log in as a user without the Admin or System Manager role. The Cancelled
   Document list is not available.
