




// frappe.pages['sbm'].on_page_load = function (wrapper) {

//     const page = frappe.ui.make_app_page({
//         parent: wrapper,
//         title: "Service Business Management",
//         single_column: true
//     });

//     // =========================
//     // PAGE LAYOUT
//     // =========================
//     $(wrapper).find('.layout-main-section').html(`
//         <div class="sbm-wrapper" style="display:flex; gap:20px;">

//             <!-- LEFT SIDEBAR -->
//             <div class="sbm-sidebar"
//                 style="
//                     width:220px;
//                     background:#f9fafb;
//                     border-right:1px solid #dcdcdc;
//                     padding:15px;
//                     height:calc(100vh - 180px);
//                     overflow-y:auto;
//                     border-radius:8px;
//                 ">

//                 <h4 style="margin-bottom:20px;">SBM Menu</h4>

//                 <div class="sbm-menu-item" data-route="Job">Jobs</div>
//                 <div class="sbm-menu-item" data-route="Task">Tasks</div>
//                 <div class="sbm-menu-item" data-route="Customer">Customers</div>
//                 <div class="sbm-menu-item" data-route="Agent">Agents</div>
//                 <div class="sbm-menu-item" data-route="Sales Invoice">Invoices</div>
//                 <div class="sbm-menu-item" data-route="Payment Entry">Payments</div>
//                 <div class="sbm-menu-item" data-route="Report">Reports</div>
//             </div>

//             <!-- RIGHT CONTENT -->
//             <div style="flex:1; padding:10px;">
//                 <button class="btn btn-primary" id="create_job_btn">
//                     Create Job
//                 </button>

//                 <div id="sbm-content" style="margin-top:20px;">
//                     <h3>Welcome to Service Business Management</h3>
//                     <p>Select a module from the left menu.</p>
//                 </div>
//             </div>
//         </div>
//     `);

//     // =========================
//     // SIDEBAR STYLES & EVENTS
//     // =========================
//     $(".sbm-menu-item")
//         .css({
//             padding: "8px 10px",
//             cursor: "pointer",
//             "border-radius": "6px",
//             "margin-bottom": "5px"
//         })
//         .hover(
//             function () { $(this).css("background", "#eef2ff"); },
//             function () { $(this).css("background", ""); }
//         )
//         .click(function () {
//             const doctype = $(this).data("route");

//             if (doctype === "Job") {
//                 load_job_cards();
//             } else {
//                 frappe.set_route("List", doctype);
//             }
//         });

//     // =========================
//     // CREATE JOB BUTTON
//     // =========================
//     $("#create_job_btn").click(() => {
//         frappe.set_route("Form", "Job", "new-job");
//     });
// };


// // ===================================================
// // LOAD JOBS AS CARDS
// // ===================================================


// function load_job_cards() {

//     $("#sbm-content").html(`
//         <h3>Jobs</h3>
//         <div id="job-card-container" class="row"></div>
//     `);

//     frappe.call({
//         method: "frappe.client.get_list",
//         args: {
//             doctype: "Job",
//             fields: [
//                 "name",
//                 "status",
//                 "job_type",
//                 "priority",
//                 "customer",
//                 "date"
//             ],
//             order_by: "date desc",
//             limit_page_length: 50
//         },
//         callback: function (r) {

//             if (!r.message || r.message.length === 0) {
//                 $("#job-card-container").html("<p>No jobs found</p>");
//                 return;
//             }

//             r.message.forEach(job => {

//                 const is_completed = job.status === "Completed";

//                 const card_bg = is_completed ? "#e9f7ef" : "#ffffff";
//                 const border_color = is_completed ? "#2ecc71" : "#e0e0e0";
//                 const status_bg = is_completed ? "#2ecc71" : "#6c757d";

//                 $("#job-card-container").append(`
//                     <div class="col-md-4">
//                         <div class="job-card" style="
//                             background:${card_bg};
//                             border:1px solid ${border_color};
//                             border-radius:12px;
//                             padding:16px;
//                             margin-bottom:18px;
//                             box-shadow:0 6px 16px rgba(0,0,0,0.08);
//                             transition:all 0.25s ease;
//                         ">

//                             <div style="display:flex; justify-content:space-between; align-items:center;">
//                                 <h5 style="margin:0; font-weight:600;">
//                                     ${job.name}
//                                 </h5>

//                                 <span style="
//                                     background:${status_bg};
//                                     color:#fff;
//                                     padding:4px 10px;
//                                     border-radius:20px;
//                                     font-size:11px;
//                                     font-weight:600;
//                                 ">
//                                     ${job.status}
//                                 </span>
//                             </div>

//                             <hr style="margin:10px 0;">

//                             <p><b>Job Type:</b> ${job.job_type || "-"}</p>
//                             <p><b>Priority:</b> ${job.priority || "-"}</p>
//                             <p><b>Customer:</b> ${job.customer || "-"}</p>
//                             <p><b>Date:</b> ${job.date || "-"}</p>

//                             <button class="btn btn-sm btn-primary view-tasks"
//                                 data-job="${job.name}">
//                                 View Tasks
//                             </button>

//                         </div>
//                     </div>
//                 `);
//             });

//             // Hover effect
//             $(".job-card").hover(
//                 function () {
//                     $(this).css("transform", "translateY(-4px)");
//                 },
//                 function () {
//                     $(this).css("transform", "translateY(0)");
//                 }
//             );

//             bind_task_buttons();
//         }
//     });
// }




// // ===================================================
// // LOAD TASKS TABLE FOR SELECTED JOB
// // ===================================================
// function bind_task_buttons() {

//     $(".view-tasks").off("click").on("click", function () {

//         const job_id = $(this).data("job");

//         $("#sbm-content").html(`
//             <h3>Tasks for Job: ${job_id}</h3>

//             <table class="table table-bordered">
//                 <thead>
//                     <tr>
//                         <th>Task ID</th>
//                         <th>Employee/Outsource</th>
//                         <th>Employee</th>
//                         <th>Outsource</th>
//                         <th>Status</th>
//                         <th>Due Date</th>
//                     </tr>
//                 </thead>
//                 <tbody id="task-table-body"></tbody>
//             </table>

//             <button class="btn btn-secondary" id="back-to-jobs">
//                 ← Back to Jobs
//             </button>
//         `);

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

//         $("#back-to-jobs").click(load_job_cards);
//     });
// }





frappe.pages['sbm'].on_page_load = function (wrapper) {

    const page = frappe.ui.make_app_page({
        parent: wrapper,
        title: "Service Business Management",
        single_column: true
    });

    // =========================
    // PAGE LAYOUT
    // =========================
    $(wrapper).find('.layout-main-section').html(`
        <div class="sbm-wrapper" style="display:flex; gap:20px;">

            <!-- LEFT SIDEBAR -->
            <div class="sbm-sidebar"
                style="
                    width:220px;
                    background:#f9fafb;
                    border-right:1px solid #dcdcdc;
                    padding:15px;
                    height:calc(100vh - 180px);
                    overflow-y:auto;
                    border-radius:8px;
                ">

                <h4 style="margin-bottom:20px;">SBM Menu</h4>

                <div class="sbm-menu-item" data-route="Job">Jobs</div>
                <div class="sbm-menu-item" data-route="Task">Tasks</div>
                <div class="sbm-menu-item" data-route="Customer">Customers</div>
                <div class="sbm-menu-item" data-route="Agent">Agents</div>
                <div class="sbm-menu-item" data-route="Sales Invoice">Invoices</div>
                <div class="sbm-menu-item" data-route="Payment Entry">Payments</div>
                <div class="sbm-menu-item" data-route="Report">Reports</div>
            </div>

            <!-- RIGHT CONTENT -->
            <div style="flex:1; padding:10px;" id="sbm-right-content">

                <div id="sbm-content" style="margin-top:20px;">
                    <h3>Service Overview</h3>
                    <div id="overview-cards" class="row" style="display:flex; gap:15px; flex-wrap:wrap;"></div>
                </div>

            </div>
        </div>
    `);

    // =========================
    // SIDEBAR STYLES & EVENTS
    // =========================
    $(".sbm-menu-item")
        .css({
            padding: "8px 10px",
            cursor: "pointer",
            "border-radius": "6px",
            "margin-bottom": "5px"
        })
        .hover(
            function () { $(this).css("background", "#eef2ff"); },
            function () { $(this).css("background", ""); }
        )
        .click(function () {
            const doctype = $(this).data("route");

            if (doctype === "Job") {
                load_job_cards(true); // true = show create button
            } else if (doctype === "Task") {
                frappe.set_route("List", "Task");
            } else if (doctype === "Customer") {
                frappe.set_route("List", "Customer");
            } else if (doctype === "Agent") {
                frappe.set_route("List", "Agent");
            } else if (doctype === "Sales Invoice") {
                frappe.set_route("List", "Sales Invoice");
            } else if (doctype === "Payment Entry") {
                frappe.set_route("List", "Payment Entry");
            } else if (doctype === "Report") {
                frappe.set_route("List", "Report");
            }
        });

    // =========================
    // LOAD OVERVIEW CARDS
    // =========================
    load_overview_cards();
};

// ===================================================
// LOAD OVERVIEW CARDS (TOTAL COUNTS)
// ===================================================


function load_overview_cards() {
    const overview = $("#overview-cards");
    overview.html(`<div class="loading">Loading...</div>`);

    const doctypes = ["Job", "Task", "Customer", "Agent", "Sales Invoice", "Payment Entry"];
    overview.html(""); // clear loading

    doctypes.forEach(dt => {
        // Get count
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: dt,
                fields: ["name"],
                limit_page_length: 0
            },
            callback: function (r) {
                const count = r.message ? r.message.length : 0;
                const colors = {
                    "Job": "#3498db",
                    "Task": "#f39c12",
                    "Customer": "#2ecc71",
                    "Agent": "#9b59b6",
                    "Sales Invoice": "#e67e22",
                    "Payment Entry": "#1abc9c"
                };

                // Append card
                overview.append(`
                    <div class="overview-card" style="
                        flex:1 0 150px;
                        background:${colors[dt] || "#7f8c8d"};
                        color:#fff;
                        border-radius:12px;
                        padding:20px;
                        text-align:center;
                        cursor:pointer;
                        box-shadow:0 6px 16px rgba(0,0,0,0.08);
                        transition:all 0.25s ease;
                    ">
                        <h4 style="margin:0 0 10px 0;">${dt}</h4>
                        <h2 style="margin:0;">${count}</h2>
                    </div>
                `);

                // ✅ Fix closure issue: capture current dt using IIFE
                (function(current_doctype){
                    $(".overview-card").last().off("click").on("click", function () {
                        if (current_doctype === "Job") {
                            load_job_cards(true); // show Create Job button
                        } else if (current_doctype === "Task") {
                            frappe.set_route("List", "Task");
                        } else if (current_doctype === "Customer") {
                            frappe.set_route("List", "Customer");
                        } else if (current_doctype === "Agent") {
                            frappe.set_route("List", "Agent");
                        } else if (current_doctype === "Sales Invoice") {
                            frappe.set_route("List", "Sales Invoice");
                        } else if (current_doctype === "Payment Entry") {
                            frappe.set_route("List", "Payment Entry");
                        }
                    });
                })(dt);

                // Hover effect
                $(".overview-card").last().hover(
                    function () { $(this).css("transform", "translateY(-4px)"); },
                    function () { $(this).css("transform", "translateY(0)"); }
                );
            }
        });
    });
}


// ===================================================
// LOAD JOBS AS CARDS
// ===================================================
function load_job_cards(show_create_btn = false) {

    let sbm_right = $("#sbm-right-content");
    sbm_right.html(`
        <div style="margin-bottom:10px;">
            ${show_create_btn ? `<button class="btn btn-primary" id="create_job_btn">Create Job</button>` : ""}
        </div>
        <div id="sbm-content">
            <h3>Jobs</h3>
            <div id="job-card-container" class="row"></div>
        </div>
    `);

    if (show_create_btn) {
        $("#create_job_btn").click(() => {
            frappe.set_route("Form", "Job", "new-job");
        });
    }

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
            container.html("");
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
                            transition:all 0.25s ease;
                        ">

                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <h5 style="margin:0; font-weight:600;">
                                    ${job.name}
                                </h5>

                                <span style="
                                    background:${status_bg};
                                    color:#fff;
                                    padding:4px 10px;
                                    border-radius:20px;
                                    font-size:11px;
                                    font-weight:600;
                                ">
                                    ${job.status}
                                </span>
                            </div>

                            <hr style="margin:10px 0;">

                            <p><b>Job Type:</b> ${job.job_type || "-"}</p>
                            <p><b>Priority:</b> ${job.priority || "-"}</p>
                            <p><b>Customer:</b> ${job.customer || "-"}</p>
                            <p><b>Date:</b> ${job.date || "-"}</p>

                            <button class="btn btn-sm btn-primary view-tasks"
                                data-job="${job.name}">
                                View Tasks
                            </button>

                        </div>
                    </div>
                `);
            });

            $(".job-card").hover(
                function () { $(this).css("transform", "translateY(-4px)"); },
                function () { $(this).css("transform", "translateY(0)"); }
            );

            bind_task_buttons();
        }
    });
}

// ===================================================
// LOAD TASKS TABLE FOR SELECTED JOB
// ===================================================
function bind_task_buttons() {

    $(".view-tasks").off("click").on("click", function () {

        const job_id = $(this).data("job");

        $("#sbm-content").html(`
            <h3>Tasks for Job: ${job_id}</h3>

            <table class="table table-bordered">
                <thead>
                    <tr>
                        <th>Task ID</th>
                        <th>Employee/Outsource</th>
                        <th>Employee</th>
                        <th>Outsource</th>
                        <th>Status</th>
                        <th>Due Date</th>
                    </tr>
                </thead>
                <tbody id="task-table-body"></tbody>
            </table>

            <button class="btn btn-secondary" id="back-to-jobs">
                ← Back to Jobs
            </button>
        `);

        frappe.call({
            method: "frappe.client.get",
            args: {
                doctype: "Job",
                name: job_id
            },
            callback: function (r) {

                if (!r.message || !r.message.tasks || r.message.tasks.length === 0) {
                    $("#task-table-body").html(`
                        <tr>
                            <td colspan="6">No tasks found</td>
                        </tr>
                    `);
                    return;
                }

                r.message.tasks.forEach(task => {
                    $("#task-table-body").append(`
                        <tr>
                            <td>${task.task_name || "-"}</td>
                            <td>${task.employee__outsource || "-"}</td>
                            <td>${task.assigned_to || "-"}</td>
                            <td>${task.assigned_tos || "-"}</td>
                            <td>${task.status || "-"}</td>
                            <td>${task.due_date || "-"}</td>
                        </tr>
                    `);
                });
            }
        });

        $("#back-to-jobs").click(() => load_job_cards(true));
    });
}
