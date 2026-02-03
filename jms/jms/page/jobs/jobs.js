frappe.pages['jobs'].on_page_load = function (wrapper) {

    frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Job',
        single_column: true
    });

    const $body = $(wrapper).find('.layout-main-section');

    // =========================
    // PAGE HTML (UNCHANGED)
    // =========================
    $body.html(`
        <div class="job-form">

            <!-- BASIC DETAILS -->
            <div class="section">
                <h4>Job Details</h4>
                <div class="row">
                    <div class="col-md-6">
                        <label>Job Name</label>
                        <input type="text" id="job_name" class="form-control">
                    </div>
                    <div class="col-md-6">
                        <label>Status</label>
                        <select id="status" class="form-control">
                            <option>Open</option>
                            <option>In Progress</option>
                            <option>Completed</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- DATES -->
            <div class="section">
                <h4>Timeline</h4>
                <div class="row">
                    <div class="col-md-4">
                        <label>Start Date</label>
                        <input type="date" id="start_date" class="form-control">
                    </div>
                    <div class="col-md-4">
                        <label>Expected Completion Date</label>
                        <input type="date" id="expected_completion_date" class="form-control">
                    </div>
                    <div class="col-md-4">
                        <label>Completion Date</label>
                        <input type="date" id="completion_date" class="form-control">
                    </div>
                </div>
            </div>

            <!-- ITEMS TABLE -->
            <div class="section">
                <h4>Services / Items</h4>
                <table class="table table-bordered" id="items_table">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Qty</th>
                            <th>Rate</th>
                            <th>Amount</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
                <button class="btn btn-sm btn-primary" id="add_item">Add Item</button>
            </div>

            <!-- TASKS TABLE -->
            <div class="section">
                <h4>Tasks</h4>
                <table class="table table-bordered" id="tasks_table">
                    <thead>
                        <tr>
                            <th>Task</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody></tbody>
                </table>
            </div>

            <!-- REMARKS -->
            <div class="section">
                <h4>Remarks</h4>
                <textarea id="notes" class="form-control" rows="4"></textarea>
            </div>

            <!-- ACTIONS -->
            <div class="form-actions">
                <button class="btn btn-success" id="save_job">Save Job</button>
            </div>

        </div>
    `);
 
    // =========================
    // ADD ITEM ROW
    // =========================
    $body.on('click', '#add_item', function () {
        const row = `
            <tr>
                <td>
                    <input type="text" class="form-control item">
                </td>
                <td>
                    <input type="number" class="form-control qty" value="1" min="1">
                </td>
                <td>
                    <input type="number" class="form-control rate" value="0">
                </td>
                <td>
                    <input type="number" class="form-control amount" value="0" readonly>
                </td>
                <td class="text-center">
                    <button class="btn btn-xs btn-danger remove-row">✕</button>
                </td>
            </tr>
        `;
        $('#items_table tbody').append(row);
    });

    // =========================
    // AUTO CALCULATE AMOUNT
    // =========================
    $body.on('input', '.qty, .rate', function () {
        const row = $(this).closest('tr');
        const qty = flt(row.find('.qty').val());
        const rate = flt(row.find('.rate').val());
        row.find('.amount').val((qty * rate).toFixed(2));
    });

    // =========================
    // REMOVE ITEM ROW
    // =========================
    $body.on('click', '.remove-row', function () {
        $(this).closest('tr').remove();
    });

};
