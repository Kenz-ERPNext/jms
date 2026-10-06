# Roles and permissions

JMS uses three roles. Two ship with the app and one is an ERPNext default.

| Role | Source | What the user can do |
| --- | --- | --- |
| Admin | Created by the app | Everything on JMS. Same access as System Manager on every JMS doctype. |
| Accounts User | ERPNext default | Add and edit Jobs, create and assign tasks, create invoices, payments and expenses from a Job. Read the master data. |
| Task Staff | Created by the app | Read Jobs. Change the status of the tasks assigned to them, nothing else. |

Admin and Accounts User also have read access to Employee, because assigning a
task to an Employee reads the Employee record.

## How it is set up

- The roles Admin and Task Staff are in `jms/fixtures/role.json` and are listed
  under `fixtures` in `jms/hooks.py`. They are created on `bench migrate`.
- The permission rows for each role are in the `permissions` list of each JMS
  doctype JSON, for example `jms/jms/doctype/job/job.json`.
- Accounts User and Admin get Employee read from the patch
  `jms/patches/v1_8/grant_employee_read.py`.

After pulling these changes on a site, run:

```
bench --site <site> migrate
bench --site <site> clear-cache
```

## Giving a user a role

1. Open **User** in the desk and create the user, or open an existing one.
2. In the **Roles** table add one role: Admin, Accounts User or Task Staff.
   Do not add System Manager to staff, it gives them everything.
3. Save.

### Task Staff needs one more step

A Task Staff user is matched to tasks through an Employee:

1. Create an **Employee** for the person and put their user in the Employee's
   **User ID** field.
2. In a Job, assign the task to that Employee (Tasks table, **Assigned To**).

The user can then change the status of that task and no other.

## Day-to-day use

### 1. Log in

Every user opens the site address in a browser and logs in with their own email
and password. A new user gets their password from the person who created the
account (User > set a password, or they use "Forgot Password" on the login
page).

### 2. Assign a task (Admin or Accounts User)

1. Open the **Job**. Create a new one or open an existing one.
2. In the **Tasks** table add a row, or open an existing row.
3. Set **Employee / Outsource** to *Employee*.
4. Set **Assigned To** to the staff member's Employee.
5. Save the Job.

The staff member is not notified, so tell them the Job number.

### 3. The assigned person updates the task (Task Staff)

1. Log in and open the **Job** list: type "Job" in the search bar (Ctrl+G), or go to `/app/job` on the site.
2. Open the Job they were told about. The task assigned to them shows their name
   in the **Assigned To** column.
3. Click the **Status** of their task and change it: Open, In Progress, Pending
   or Completed.
4. If they choose **Pending**, open the task row (pencil icon at the end of the
   row) and fill in **Pending Reason**.
5. Save the Job.

Everything else on the Job is read-only for them. They cannot change the status
of a task that is assigned to someone else.

## What Task Staff can and cannot do

- Can change the status of tasks assigned to them: Open, In Progress, Pending,
  Completed.
- When the status is Pending, **Pending Reason** must be filled in.
- Cannot edit any other field on the Job, add or delete tasks, or create
  invoices, payments or expenses.
- This is enforced on the server in `Job.limit_task_staff_to_status` (and the
  `office_only` decorator on the money methods) in
  `jms/jms/doctype/job/job.py`. The form is also locked in `job.js`
  (`lockJobForTaskStaff`), but that is only for the user's convenience.

## Things that can surprise you

- **Custom DocPerm overrides the JSON.** If a doctype has rows in
  *Role Permission Manager* (Custom DocPerm), Frappe ignores the permissions in
  the doctype JSON for that doctype. If a role does not behave as described
  here on a site, check the Custom DocPerm rows for that doctype first.
- **The Job workflow can make the form read-only.** A site may have an active
  Workflow on Job (for example an edit-approval flow). Roles that are not
  allowed to edit in the current workflow state see the whole form read-only.
  `lockJobForTaskStaff` in `job.js` puts the normal permissions back for Task
  Staff only.
- **A Pending task without a reason blocks saving.** Pending Reason is mandatory
  whenever the status is Pending, so an old task that is already Pending with no
  reason must be given one before its Job can be saved.

## Test data

Use this data to check the roles on a development or test site. Create it by
hand in the desk.

**Users** (User list, user type System User, one role each):

| Email | Role | Notes |
| --- | --- | --- |
| test.admin@example.com | Admin | |
| test.accounts@example.com | Accounts User | |
| test.staff@example.com | Task Staff | Also needs the Employee below. |

**Employee:** name "Test Staff", with **User ID** `test.staff@example.com`.

**Customer:** "Test Customer".

**Job:** title "Test Job (roles)", customer "Test Customer", any Job Type, with
two tasks:

| Task name | Employee / Outsource | Assigned To | Status |
| --- | --- | --- | --- |
| Task for Test Staff | Employee | Test Staff | Open |
| Unassigned task | | | Open |

**Expected results**

| Login | Result |
| --- | --- |
| test.staff | Only the Status of "Task for Test Staff" can be changed. Everything else is read-only. Setting Pending without a Pending Reason is refused. |
| test.accounts | Can create a Job, assign a task to Test Staff, and create invoices and payments. |
| test.admin | Can do everything on JMS. |

## How to test

1. Create the test data above.
2. Log in as each user and check the expected results.
