# JMS - Complete Setup & Usage Guide

## Installation Complete! ✅

All features have been successfully implemented and sample data has been installed.

## What's New - Latest Updates

### 1. ✅ Sample Data Installed
All master data has been created:
- 5 Job Types (Company Formation, Visa Processing, Audit Services, Tax Filing, Business License)
- 12 Job Natures
- 7 Job Sources
- 4 Agents
- 3 Outsourced Parties
- 5 Work Templates with sub-tasks

### 2. ✅ List View Enhancements
- **Status Indicators**: Color-coded status pills
  - CREATED (Blue)
  - PROCESSING (Orange)
  - COMPLETED (Green)
  - REJECTED (Red)
  - CANCELED (Dark Grey)
  - PENDING_EXT(COMPLETED) (Purple)
  - AMT_PENDING(COMPLETED) (Yellow)

- **Priority Indicators**: Color-coded priority levels
- **Balance Highlighting**: Red for pending, Green for paid
- **Overdue Status**: Visual indicators for overdue jobs

### 3. ✅ Workflow Implementation
Complete workflow with state management:
```
CREATED → PROCESSING → COMPLETED
    ↓           ↓
REJECTED    AMT_PENDING(COMPLETED)
CANCELED    PENDING_EXT(COMPLETED)
```

**Available Actions**:
- Start Processing
- Mark Complete
- Payment Pending
- External Pending
- Reject
- Cancel
- Send Back

### 4. ✅ Delete/Cancel Controls
- Cannot delete COMPLETED, CANCELED, or REJECTED jobs
- Cannot delete jobs linked to invoices
- Cannot cancel jobs with submitted invoices
- Validation before all destructive operations

### 5. ✅ Connections Dashboard
Jobs can be linked to:
- Sales Invoices
- Payment Entries
- Tasks

## Quick Start - Creating Your First Job

### Step 1: Access JMS
1. Login to ERPNext
2. Go to **JMS** workspace (sidebar)
3. Click on **Job** > **New**

### Step 2: Basic Info
```
Job Title: Company Formation - ABC Trading LLC
Date: Today
Year: (Auto-filled)
```

### Step 3: Customer/Agent Selection

**Option A - Existing Customer**:
- Select customer from dropdown
- Customer details auto-filled

**Option B - Create from Agent**:
1. Check "Create Customer from Agent"
2. Select Agent (e.g., "Ahmed Ali")
3. Customer will be auto-created
4. Commission auto-calculated

### Step 4: Job Details
```
Job Type: Company Formation
Job Nature: Premium
Priority: High
Job Source: Referral
```

### Step 5: Add Services/Items
1. Click **Add Row** in Items table
2. Select Work Template (e.g., "111 - Company Registration")
3. All pricing auto-fills:
   - Fee Price: 35,000
   - Surcharge: 6,000
   - Total auto-calculated
4. Tasks auto-create if template has sub-tasks

### Step 6: Assignment (Optional)
```
Assigned Agent: Ahmed Ali (brings business)
Assigned Outsourced Party: Legal Services LLC (does work)
Staff Assignment: Add internal team members
```

### Step 7: Save & Workflow
1. Click **Save**
2. Status starts as "CREATED"
3. Use workflow actions:
   - **Start Processing** → Moves to PROCESSING
   - Work on tasks
   - **Mark Complete** → COMPLETED (if paid)
   - **Payment Pending** → AMT_PENDING(COMPLETED) (if balance exists)

## Features Demonstration

### List View Features
1. Go to **JMS > Job** (list view)
2. See color-coded statuses
3. Use menu buttons:
   - **Create Sample Jobs** - Generate 5 test jobs
   - **Show Only Processing** - Quick filter
   - **Show Only Overdue** - See delayed jobs
   - **Show Unpaid** - Jobs with balance

### Status Indicators
- **Blue pill**: CREATED - New job
- **Orange pill**: PROCESSING - Work in progress
- **Green pill**: COMPLETED - All done & paid
- **Yellow pill**: AMT_PENDING - Work done, payment pending
- **Purple pill**: PENDING_EXT - Waiting for external party
- **Red pill**: REJECTED/Overdue

### Workflow Usage
On any job form:
1. See current status at top
2. Available actions show as buttons
3. Click action to change state
4. System validates transitions

### Calculations
All calculations are automatic:
```
Item Level:
  (Fee × Qty) + Extra + Surcharge = Subtotal
  Subtotal + (Subtotal × VAT%) = Item Total

Job Level:
  Sum of all items = Gross Amount
  Gross - Discount = Subtotal
  Subtotal + (Subtotal × VAT%) = Net Amount
  Net Amount - Paid Up = Balance

Commission:
  If Percentage: Net Amount × Rate%
  If Fixed: Fixed amount
```

### Delete/Cancel Protection
**Try This**:
1. Create a job
2. Change status to COMPLETED
3. Try to delete → Error message
4. Try to cancel → Error message

**Works Because**:
- COMPLETED jobs cannot be deleted
- COMPLETED jobs cannot be cancelled
- Protects your data integrity

## Advanced Features

### Auto Task Creation
1. Create Work Template with sub-tasks
2. Add template to job as item
3. Watch tasks auto-create
4. Tasks have proper due dates based on "days from start"

### Customer Portal Access
Your customers can:
- Login to portal
- View their jobs
- See status updates
- Check progress
- Update work templates notes

### Smart Status Updates
System automatically:
- Changes CREATED → PROCESSING when tasks start
- Changes to COMPLETED when tasks done & paid
- Changes to AMT_PENDING when tasks done & balance exists
- Tracks overdue status

### Commission Tracking
For agents:
- Set commission type (Percentage/Fixed)
- Set rate
- Commission auto-calculates on job
- Track total commissions per agent

## Sample Data Details

### Work Templates Created
1. **111 - Company Registration** (35,000 + 6,000 surcharge)
   - 5 sub-tasks from document collection to license collection

2. **108 - VISA** (10,000 extra charge)
   - 5 sub-tasks for complete visa process

3. **111A - Company Purchase** (15,000)
   - 4 sub-tasks for company acquisition

4. **114 - Counter Charge** (0 charges)
5. **102 - ONLINE SERVICES** (20,000 surcharge)

### Agents Created
- Ahmed Ali (10% commission)
- Sarah Mohammed (15% commission)
- John Smith (500 fixed commission)
- Fatima Hassan (12% commission)

### Outsourced Parties
- Legal Services LLC
- Document Processing Center
- PRO Services Dubai

## Testing Checklist

### ✅ Test List View
- [ ] See color-coded statuses
- [ ] Filter by status
- [ ] Filter by overdue
- [ ] Filter by unpaid
- [ ] Create sample jobs button works

### ✅ Test Job Creation
- [ ] Create job with existing customer
- [ ] Create job from agent
- [ ] Add multiple work templates
- [ ] See tasks auto-create
- [ ] Calculations correct

### ✅ Test Workflow
- [ ] Start Processing action works
- [ ] Mark Complete works
- [ ] Payment Pending works
- [ ] Cancel works
- [ ] Cannot delete COMPLETED job

### ✅ Test Calculations
- [ ] Item totals calculate correctly
- [ ] Gross amount sums items
- [ ] Discount applies
- [ ] VAT calculates
- [ ] Balance = Net - Paid

### ✅ Test Assignments
- [ ] Assign agent
- [ ] Commission calculates
- [ ] Assign outsourced party
- [ ] Assign staff
- [ ] Only one primary staff allowed

## Commands Reference

### Install Fresh Sample Data
```bash
cd /path/to/frappe-bench
bench --site jms.local execute jms.jms.fixtures.sample_data.install_sample_data
```

### Clear Sample Data
```python
# In bench console
from jms.jms.fixtures.sample_data import clear_sample_data
clear_sample_data()
```

### Create Sample Jobs
```python
# In bench console
from jms.jms.fixtures.sample_data import create_sample_jobs
create_sample_jobs()
```

### Run Migration
```bash
bench --site jms.local migrate
```

### Clear Cache
```bash
bench --site jms.local clear-cache
bench --site jms.local clear-website-cache
```

## Troubleshooting

### Issue: Sample data not showing
**Solution**: Run migration first
```bash
bench --site jms.local migrate
bench --site jms.local execute jms.jms.fixtures.sample_data.install_sample_data
```

### Issue: Workflow actions not showing
**Solution**: Clear cache
```bash
bench --site jms.local clear-cache
```

### Issue: List view not colored
**Solution**: Hard refresh browser (Ctrl+Shift+R / Cmd+Shift+R)

### Issue: Cannot delete job
**Check**:
- Is status COMPLETED, CANCELED, or REJECTED?
- Is job linked to invoice?
- These are protected by design

## Next Steps

### 1. Customize Work Templates
- Add your own services
- Set your pricing
- Create sub-task templates

### 2. Setup Users & Roles
- Create staff users
- Assign to jobs
- Set permissions

### 3. Create Real Jobs
- Use actual customers
- Add real work templates
- Track real progress

### 4. Reports
- Job Status Report (already created)
- Create custom reports as needed
- Export data for analysis

### 5. Integration
- Link to ERPNext Sales Invoices
- Create Payment Entries
- Track in accounting

## Summary of All Features

✅ **Master Data**
- Job Types, Natures, Sources
- Agents with commission
- Outsourced Parties
- Work Templates with pricing & sub-tasks

✅ **Job Management**
- Customer/Agent selection
- Services/Items with pricing
- Auto task creation
- Staff assignment
- Document tracking

✅ **Calculations**
- Item-level VAT
- Job-level discount & VAT
- Balance tracking
- Commission calculation

✅ **Workflow**
- 7 status states
- 11 workflow transitions
- Delete/Cancel protection
- Auto status updates

✅ **List View**
- Color-coded indicators
- Quick filters
- Sample data generation
- Smart formatting

✅ **Connections**
- Sales Invoice link
- Payment Entry link
- Task link
- Dashboard view

✅ **Customer Portal**
- Customer role permissions
- Status viewing
- Work updates

---

**You're all set! 🎉**

The system is fully configured with sample data. Start creating real jobs and manage your consulting business efficiently!

For questions or issues, check the documentation files:
- [README.md](README.md) - Complete feature documentation
- [CHANGES_BASED_ON_REQUIREMENTS.md](CHANGES_BASED_ON_REQUIREMENTS.md) - What changed
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - Technical details
