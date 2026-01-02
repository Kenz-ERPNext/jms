frappe.pages['job-list'].on_page_load = function (wrapper) {

    frappe.ui.make_app_page({
        parent: wrapper,
        title: 'Job List',
        single_column: true
    });

    $(wrapper).find('.layout-main-section').html(`
        <div id="job-list-wrapper">
            <div id="job-content"></div>
        </div>
    `);

    render_job_cards();
};

// ===================================================
// RENDER JOB CARDS
// ===================================================
function render_job_cards() {

    $("#job-content").html(`
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">

            <button class="btn btn-outline-secondary" id="back-to-sbm" style="
				background-color: black;
				color: white;
				border-color: black;
			">
                ← Back to SBM
            </button>

            <button class="btn btn-primary" id="create_job_btn"
			style="
                padding: 10px 24px;   
                font-size: 16px;      
                border-radius: 8px;   
            ">
                Create Job
            </button>
        </div>

        <div id="job-card-container" class="row"></div>
    `);

    $("#back-to-sbm").on("click", () => {
        frappe.set_route("sbm");
    });

    $("#create_job_btn").on("click", () => {
        frappe.set_route("Form", "Job", "new-job");
    });

    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "Job",
            fields: [
                "name",
                "status",
                "job_type",
                "priority",
                "customer",
                "date"
            ],
            order_by: "date desc",
            limit_page_length: 50
        },
        callback: function (r) {

            const container = $("#job-card-container");
            container.empty();

            if (!r.message || r.message.length === 0) {
                container.html("<p>No jobs found</p>");
                return;
            }

            r.message.forEach(job => {

                const is_completed = job.status === "Completed";
                const card_bg = is_completed ? "#e9f7ef" : "#ffffff";
                const border_color = is_completed ? "#2ecc71" : "#e0e0e0";
                const status_bg = is_completed ? "#2ecc71" : "#6c757d";

                container.append(`
                    <div class="col-md-4">
                        <div class="job-card" style="
                            background:${card_bg};
                            border:1px solid ${border_color};
                            border-radius:12px;
                            padding:16px;
                            margin-bottom:18px;
                            box-shadow:0 6px 16px rgba(0,0,0,0.08);
                        ">

                            <div style="display:flex; justify-content:space-between;">
                                <h5>${job.name}</h5>
                                <span style="
                                    background:${status_bg};
                                    color:#fff;
                                    padding:4px 10px;
                                    border-radius:20px;
                                    font-size:11px;
                                ">
                                    ${job.status}
                                </span>
                            </div>

                            <hr>

                            <p><b>Job Type:</b> ${job.job_type || "-"}</p>
                            <p><b>Priority:</b> ${job.priority || "-"}</p>
                            <p><b>Customer:</b> ${job.customer || "-"}</p>
                            <p><b>Date:</b> ${job.date || "-"}</p>

                            <div style="display:flex; gap:8px;">
                                <button class="btn btn-sm btn-primary open-job"
                                    data-job="${job.name}">
                                    Open Job
                                </button>

                                <button class="btn btn-sm btn-outline-secondary view-tasks"
                                    data-job="${job.name}">
                                    View Tasks
                                </button>
                            </div>
                        </div>
                    </div>
                `);
            });

            bind_job_buttons();
            bind_task_buttons();
        }
    });
}

// ===================================================
// OPEN JOB FORM
// ===================================================
function bind_job_buttons() {
    $(".open-job").off("click").on("click", function () {
        frappe.set_route("Form", "Job", $(this).data("job"));
    });
}

// ===================================================
// LOAD TASKS TABLE (SAME PAGE)
// ===================================================


function bind_task_buttons() {
    $(".view-tasks").off("click").on("click", function () {
        const job_id = $(this).data("job");

        // Pass the Job name in the route
        frappe.set_route(["task-list", job_id]);
    });
}




// function bind_task_buttons() {

//     $(".view-tasks").off("click").on("click", function () {

//         const job_id = $(this).data("job");

//         $("#job-content").html(`
//             <div style="display:flex; gap:10px; margin-bottom:10px;">
//                 <button class="btn btn-outline-secondary" id="back-to-sbm">
//                     ← Back to SBM
//                 </button>
//                 <button class="btn btn-outline-secondary" id="back-to-jobs">
//                     ← Back to Jobs
//                 </button>
//             </div>

//             <h3>Tasks for Job: ${job_id}</h3>

//             <table class="table table-bordered">
//                 <thead>
//                     <tr>
//                         <th>Task</th>
//                         <th>Employee/Outsource</th>
//                         <th>Employee</th>
//                         <th>Outsource</th>
//                         <th>Status</th>
//                         <th>Due Date</th>
//                     </tr>
//                 </thead>
//                 <tbody id="task-table-body"></tbody>
//             </table>
//         `);

//         $("#back-to-sbm").on("click", () => {
//             frappe.set_route("sbm");
//         });

//         $("#back-to-jobs").on("click", () => {
//             render_job_cards();
//         });

//         frappe.call({
//             method: "frappe.client.get",
//             args: {
//                 doctype: "Job",
//                 name: job_id
//             },
//             callback: function (r) {

//                 if (!r.message || !r.message.tasks || r.message.tasks.length === 0) {
//                     $("#task-table-body").html(`
//                         <tr>
//                             <td colspan="6">No tasks found</td>
//                         </tr>
//                     `);
//                     return;
//                 }

//                 r.message.tasks.forEach(task => {
//                     $("#task-table-body").append(`
//                         <tr>
//                             <td>${task.task_name || "-"}</td>
//                             <td>${task.employee__outsource || "-"}</td>
//                             <td>${task.assigned_to || "-"}</td>
//                             <td>${task.assigned_tos || "-"}</td>
//                             <td>${task.status || "-"}</td>
//                             <td>${task.due_date || "-"}</td>
//                         </tr>
//                     `);
//                 });
//             }
//         });
//     });
// }
