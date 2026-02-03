frappe.pages['task-list'].on_page_load = function(wrapper) {
    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Task List',
        single_column: true
    });

    const buttons_html = `
        <div style="display:flex; gap:10px; margin-bottom:10px;">
            <button class="btn btn-outline-secondary" id="back-to-sbm">← Back to SBM</button>
            <button class="btn btn-outline-secondary" id="back-to-jobs">← Back to Jobs</button>
        </div>
    `;

    // Back buttons
    function bind_back_buttons() {
        $("#back-to-sbm").off("click").on("click", () => frappe.set_route("sbm"));
        $("#back-to-jobs").off("click").on("click", () => frappe.set_route("job-list"));
    }
    bind_back_buttons();

    // Fetch tasks for the selected job
    function fetch_tasks() {
        const route = frappe.get_route();
        const job_id = route.length > 1 ? route[1] : null;

        if (!job_id) {
            $(wrapper).find('.layout-main-section').html(buttons_html + "<p>No Job selected</p>");
            return;
        }

        $(wrapper).find('.layout-main-section').html(buttons_html + `<p>Loading tasks for Job: ${job_id}...</p>`);

        frappe.call({
            method: "frappe.client.get",
            args: { doctype: "Job", name: job_id },
            callback: function(r) {
                const job = r.message;
                if (!job) {
                    $(wrapper).find('.layout-main-section').html(buttons_html + "<p>Job not found</p>");
                    return;
                }

                const tasks = job.tasks || [];

                // Build table
                let html = `
                    <h3>Tasks for Job: ${job_id}</h3>
                    <table class="table table-bordered">
                        <thead>
                            <tr>
                                <th>Task</th>
                                <th>Employee/Outsource</th>
                                <th>Employee</th>
                                <th>Outsource</th>
                                <th>Status</th>
                                <th>Due Date</th>
                            </tr>
                        </thead>
                        <tbody>
                `;

                if (tasks.length === 0) {
                    html += `<tr><td colspan="6">No tasks found</td></tr>`;
                } else {
                    tasks.forEach(task => {
                        html += `
                            <tr>
                                <td>${task.task_name || "-"}</td>
                                <td>${task.employee__outsource || "-"}</td>
                                <td>${task.assigned_to || "-"}</td>
                                <td>${task.assigned_tos || "-"}</td>
                                <td>
                                    <select class="form-select task-status" data-task-id="${task.name}">
                                        <option ${task.status=="Open" ? "selected":""}>Open</option>
                                        <option ${task.status=="Pending" ? "selected":""}>Pending</option>
                                        <option ${task.status=="In Progress" ? "selected":""}>In Progress</option>
                                        <option ${task.status=="Completed" ? "selected":""}>Completed</option>
                                        <option ${task.status=="Cancelled" ? "selected":""}>Cancelled</option>
                                    </select>
                                    <button class="btn btn-sm btn-primary save-status" style="display:none; margin-left:5px;" data-task-id="${task.name}">Save</button>
                                </td>
                                <td>${task.due_date || "-"}</td>
                            </tr>
                        `;
                    });
                }

                html += `</tbody></table>`;
                $(wrapper).find('.layout-main-section').html(buttons_html + html);

                bind_back_buttons();

                // Show save button on change
                $(".task-status").off("change").on("change", function() {
                    const task_id = $(this).data("task-id");
                    $(`.save-status[data-task-id='${task_id}']`).show();
                });

                // Save status
                $(".save-status").off("click").on("click", function() {
                    const task_id = $(this).data("task-id");
                    const new_status = $(`.task-status[data-task-id='${task_id}']`).val();

                    // Update child task
                    frappe.call({
                        method: "frappe.client.set_value",
                        args: {
                            doctype: "Job Task", // <-- your child table doctype
                            name: task_id,
                            fieldname: "status",
                            value: new_status
                        },
                        callback: function() {
                            frappe.show_alert({message: "Task status updated", indicator: "green"});
                            $(`.save-status[data-task-id='${task_id}']`).hide();

                            // --- Replicate set_job_status logic ---
                            frappe.call({
                                method: "frappe.client.get",
                                args: { doctype: "Job", name: job_id },
                                callback: function(r2) {
                                    const job = r2.message;
                                    if (!job || !job.tasks) return;

                                    // Check all tasks
                                    let all_completed = job.tasks.every(t => t.status === "Completed");
                                    let all_in_progress = job.tasks.every(t => t.status === "In Progress");

                                    let job_status = job.status;

                                    if (all_completed) {
                                        job_status = "Completed";
                                    } else if (all_in_progress) {
                                        job_status = "In Progress";
                                    } else {
                                        job_status = job.status; // do not change
                                    }

                                    // Update Job status if changed
                                    if (job_status !== job.status) {
                                        frappe.call({
                                            method: "frappe.client.set_value",
                                            args: {
                                                doctype: "Job",
                                                name: job_id,
                                                fieldname: "status",
                                                value: job_status
                                            },
                                            callback: function() {
                                                // Set completion date if all completed
                                                if (all_completed) {
                                                    frappe.call({
                                                        method: "frappe.client.set_value",
                                                        args: {
                                                            doctype: "Job",
                                                            name: job_id,
                                                            fieldname: "completion_date",
                                                            value: frappe.datetime.get_today()
                                                        }
                                                    });
                                                }
                                                frappe.show_alert({message: `Job status set to ${job_status}`, indicator: "blue"});
                                            }
                                        });
                                    }
                                }
                            });
                        }
                    });
                });
            }
        });
    }

    // Initial fetch
    fetch_tasks();

    // Auto-refresh every 10 seconds
    setInterval(fetch_tasks, 10000);

    // Refresh when navigating to different job
    frappe.pages['task-list'].on_page_show = function() {
        fetch_tasks();
    };
};
 