# JMS - Job Management System

A comprehensive ERPNext custom app for consulting and service businesses to manage jobs, tasks, staff assignments, and client workflows for government paperwork, audits, and company formation services.

## Features

### Core Modules

1. **Job Management**
   - Complete job lifecycle tracking from creation to completion
   - Priority-based job handling (Low, Medium, High, Urgent)
   - Status workflow (Draft → In Progress → On Hold → Under Review → Completed)
   - Automatic task generation based on job type templates
   - Progress tracking and reporting

2. **Master Data**
   - **Job Types**: Define service categories (Company Formation, Audit, Visa, etc.)
   - **Job Nature**: Subcategories for each job type (Basic, Premium, Express)
   - **Agents**: Manage referral agents with commission tracking
   - **Job Source**: Track lead sources (Walk-in, Referral, Website)

3. **Task Management**
   - Automatic task creation from templates
   - Task assignment to staff members
   - Due date tracking and reminders
   - Task status monitoring (Pending, In Progress, Completed, Cancelled)

4. **Staff Assignment**
   - Assign multiple staff members to jobs
   - Primary staff designation
   - Role-based assignments
   - Workload tracking

5. **Document Management**
   - Track required documents for each job
   - Document receipt status
   - File attachments support

6. **Commission Management**
   - Agent commission calculation (Percentage or Fixed Amount)
   - Automatic commission computation based on job value

7. **Billing Integration**
   - Link jobs to Sales Invoices
   - Track billing status (Not Billed, Partially Billed, Fully Billed)

8. **Reports**
   - Job Status Report with filters
   - Staff workload analysis
   - Agent performance tracking
   - Revenue by job type

## Installation

You can install this app using the [bench](https://github.com/frappe/bench) CLI:

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch develop
bench --site your-site install-app jms
bench --site your-site migrate
```

## Quick Start Guide

### 1. Setup Master Data

After installation, set up the following master data:

#### Job Types
Navigate to **JMS > Job Type** and create your service types:
- Company Formation
- Audit Services
- Visa Processing
- Tax Filing
- Business License

For each job type, set:
- Job Type Name
- Description
- Default Duration (Days)
- Is Active

#### Job Nature
Navigate to **JMS > Job Nature** and create subcategories:
- Company Formation - Basic
- Company Formation - Premium
- Company Formation - Express
- Audit - Annual Audit
- Audit - Special Audit

#### Job Sources
Navigate to **JMS > Job Source** and create lead sources:
- Walk-in
- Referral
- Website
- Phone Call
- Email

For each source, specify if an agent is required.

#### Agents
Navigate to **JMS > Agent** and create agents:
- Agent Name
- Contact Details (Mobile, Email)
- Commission Type (Percentage or Fixed Amount)
- Commission Rate
- Linked Customer (if agent is also a customer)

### 2. Create Task Templates

Navigate to **JMS > Job Task Template** and create task templates for each job type:

Example for "Company Formation":
1. Collect Required Documents (Day 0)
2. Verify Documents (Day 1)
3. Submit to Authorities (Day 3)
4. Follow up on Application (Day 7)
5. Collect Certificate (Day 14)

### 3. Create a Job

Navigate to **JMS > Job** and click "New":

1. **Basic Info**
   - Job Title
   - Customer
   - Job Type (will auto-populate tasks from templates)
   - Job Nature
   - Priority

2. **Source & Agent**
   - Job Source
   - Agent (if applicable)
   - Commission (auto-calculated)

3. **Timeline**
   - Start Date
   - Expected End Date (auto-calculated from job type)

4. **Staff Assignment**
   - Add staff members
   - Mark one as primary

5. **Tasks**
   - Auto-generated from templates
   - Can add/edit tasks manually
   - Assign to specific staff
   - Set due dates

6. **Documents**
   - Add required documents
   - Mark as received
   - Attach files

7. **Billing**
   - Total Amount
   - Billing Status
   - Link to Sales Invoice

### 4. Work with Jobs

**Change Status:**
- Draft → Start → In Progress
- In Progress → Put On Hold → On Hold
- On Hold → Resume → In Progress
- In Progress → Submit for Review → Under Review
- Under Review → Complete → Completed
- Under Review → Send Back → In Progress

**Track Progress:**
- Click "Get Progress" button to see completion percentage
- Monitor task completion status
- Check overdue tasks

**Create Invoice:**
- Set Total Amount
- Click "Create" → "Create Invoice"
- System will generate Sales Invoice

## DocType Structure

### Main DocTypes

1. **Job** (Main Document)
   - Naming: JOB-.YYYY.-.#####
   - Tracks complete job lifecycle

2. **Job Type** (Master)
   - Service category master

3. **Job Nature** (Master)
   - Service subcategory
   - Linked to Job Type

4. **Agent** (Master)
   - Referral agent details
   - Commission settings

5. **Job Source** (Master)
   - Lead source tracking

6. **Job Task Template** (Master)
   - Pre-defined task templates for job types

### Child Tables

1. **Job Task**
   - Task details within a job
   - Assignment and status tracking

2. **Job Staff Assignment**
   - Staff members assigned to job
   - Role designation

3. **Job Document**
   - Required documents tracking
   - Receipt status

## API Methods

### Get Job Progress

```python
frappe.call({
    method: 'jms.jms.doctype.job.job.get_job_progress',
    args: {
        job_name: 'JOB-2025-00001'
    },
    callback: function(r) {
        console.log(r.message);
        // Returns: {
        //     progress: 75.5,
        //     total_tasks: 10,
        //     completed_tasks: 8,
        //     pending_tasks: 1,
        //     in_progress_tasks: 1
        // }
    }
});
```

## Business Logic Features

### Auto Task Creation
When a job is created with a Job Type, tasks are automatically created from Job Task Template.

### Commission Calculation
Agent commission is automatically calculated based on:
- Commission Type (Percentage or Fixed)
- Total Amount
- Commission Rate

### Duration Calculation
Job duration is calculated based on:
- Start Date
- Expected/Actual End Date

### Expected End Date
Auto-set based on Job Type's default duration if not specified.

### Staff Validation
Only one staff member can be marked as Primary.

### Auto Status Update
Status automatically updates based on task completion:
- 100% complete → Under Review
- >0% complete → In Progress

## Reports

### Job Status Report
Navigate to **JMS > Reports > Job Status Report**

**Filters:**
- Status
- Job Type
- Customer
- Date Range

**Columns:**
- Job ID
- Job Title
- Customer
- Job Type
- Priority
- Status
- Start Date
- Expected End Date
- Actual End Date
- Amount
- Billing Status

## Workflow

The Job workflow includes the following states:

```
Draft → In Progress → Under Review → Completed
            ↓
        On Hold
```

**Transitions:**
- Start: Draft → In Progress
- Put On Hold: In Progress → On Hold
- Resume: On Hold → In Progress
- Submit for Review: In Progress → Under Review
- Complete: Under Review → Completed
- Send Back: Under Review → In Progress
- Cancel: Any → Cancelled

## Workspace

The JMS workspace provides quick access to:

**Shortcuts:**
- Jobs (with open job count)
- Job Types
- Agents
- Customers

**Quick Links:**
- All DocTypes
- Reports

## Integration with ERPNext

JMS integrates seamlessly with ERPNext:

- **Customer**: Link jobs to existing customers
- **Sales Invoice**: Create invoices from jobs
- **User**: Assign tasks to ERPNext users

## Future Enhancements

Planned features for future releases:

1. Dashboard with charts and KPIs
2. Email notifications for task assignments
3. Overdue task reminders
4. Staff workload report
5. Agent performance dashboard
6. Revenue by job type report
7. Mobile app support
8. WhatsApp integration for notifications
9. Document templates
10. Bulk job creation

### Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/jms
pre-commit install
```

Pre-commit is configured to use the following tools for checking and formatting your code:

- ruff
- eslint
- prettier
- pyupgrade

### CI

This app can use GitHub Actions for CI. The following workflows are configured:

- CI: Installs this app and runs unit tests on every push to `develop` branch.
- Linters: Runs [Frappe Semgrep Rules](https://github.com/frappe/semgrep-rules) and [pip-audit](https://pypi.org/project/pip-audit/) on every pull request.


### License

mit
