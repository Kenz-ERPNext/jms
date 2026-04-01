// frappe.pages['job-list'].on_page_load = function (wrapper) {

//     frappe.ui.make_app_page({
//         parent: wrapper,
//         title: 'Job List',
//         single_column: true
//     });

//     $(wrapper).find('.layout-main-section').html(`
//         <div id="job-list-wrapper">
//             <div id="job-content"></div>
//         </div>
//     `);

//     render_job_cards();
// };

// // ===================================================
// // RENDER JOB CARDS
// // ===================================================
// function render_job_cards() {

//     $("#job-content").html(`
//         <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">

//             <button class="btn btn-outline-secondary" id="back-to-sbm"
//                 style="background-color:black; color:white; border-color:black;">
//                 ← Back to SBM
//             </button>

//             <button class="btn btn-primary" id="create_job_btn"
//                 style="padding:10px 24px; font-size:16px; border-radius:8px;">
//                 Create Job
//             </button>
//         </div>

//         <div id="job-card-container" class="row"></div>
//     `);

//     $("#back-to-sbm").on("click", () => {
//         frappe.set_route("sbm");
//     });

//     $("#create_job_btn").on("click", () => {
//         frappe.set_route("Form", "Job", "new-job");
//     });

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

//             const container = $("#job-card-container");
//             container.empty();

//             if (!r.message || r.message.length === 0) {
//                 container.html("<p>No jobs found</p>");
//                 return;
//             }

//             r.message.forEach(job => {

//                 const is_completed = job.status === "Completed";

//                 const card_bg = is_completed ? "#e9f7ef" : "#ffffff";
//                 const border_color = is_completed ? "#2ecc71" : "#e0e0e0";
//                 const status_bg = is_completed ? "#2ecc71" : "#6c757d";

//                 const priority_bg =
//                     job.priority === "High" ? "#e74c3c" :
//                     job.priority === "Medium" ? "#f39c12" :
//                     job.priority === "Low" ? "#3498db" :
//                     "#6c757d";

//                 container.append(`
//                     <div class="col-md-4">
//                         <div class="job-card" style="
//                             background:${card_bg};
//                             border:1px solid ${border_color};
//                             border-radius:12px;
//                             padding:16px;
//                             margin-bottom:18px;
//                             box-shadow:0 6px 16px rgba(0,0,0,0.08);
//                         ">

//                             <!-- HEADER -->
//                             <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
//                                 <h5 style="margin:0;">${job.name}</h5>

//                                 <div style="display:flex; gap:6px; align-items:center;">
                                    
//                                     ${
//                                         !is_completed
//                                         ? `
//                                         <span style="
//                                             background:${priority_bg};
//                                             color:#fff;
//                                             padding:4px 10px;
//                                             border-radius:20px;
//                                             font-size:11px;
//                                             white-space:nowrap;
//                                         ">
//                                             ${job.priority || "No Priority"}
//                                         </span>
//                                         `
//                                         : ``
//                                     }

//                                     <span style="
//                                         background:${status_bg};
//                                         color:#fff;
//                                         padding:4px 10px;
//                                         border-radius:20px;
//                                         font-size:11px;
//                                         white-space:nowrap;
//                                     ">
//                                         ${job.status}
//                                     </span>

//                                 </div>
//                             </div>

//                             <hr>

//                             <!-- BODY -->
//                             <p><b>Job Type:</b> ${job.job_type || "-"}</p>
//                             <p><b>Priority:</b> ${job.priority || "-"}</p>
//                             <p><b>Customer:</b> ${job.customer || "-"}</p>
//                             <p><b>Date:</b> ${job.date || "-"}</p>

//                             <!-- ACTIONS -->
//                             <div style="display:flex; gap:8px;">
//                                 <button class="btn btn-sm btn-primary open-job"
//                                     data-job="${job.name}">
//                                     Open Job
//                                 </button>

//                                 <button class="btn btn-sm btn-outline-secondary view-tasks"
//                                     data-job="${job.name}">
//                                     View Tasks
//                                 </button>
//                             </div>

//                         </div>
//                     </div>
//                 `);
//             });

//             bind_job_buttons();
//             bind_task_buttons();
//         }
//     });
// }

// // ===================================================
// // OPEN JOB FORM
// // ===================================================
// function bind_job_buttons() {
//     $(".open-job").off("click").on("click", function () {
//         frappe.set_route("Form", "Job", $(this).data("job"));
//     });
// }

// // ===================================================
// // VIEW TASKS PAGE
// // ===================================================
// function bind_task_buttons() {
//     $(".view-tasks").off("click").on("click", function () {
//         const job_id = $(this).data("job");
//         frappe.set_route(["task-list", job_id]);
//     });
// }









// ===================================================
// GLOBAL STATE (IMPORTANT ✅)
// ===================================================
let current_sort_order = "desc";

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

            <button class="btn btn-outline-secondary" id="back-to-sbm"
                style="background-color:black; color:white; border-color:black;">
                ← Back to SBM
            </button>

            <div style="display:flex; gap:10px; align-items:center;">
                
                <!-- ✅ SORT DROPDOWN -->
                <select id="sort-order" class="form-control" style="width:220px;">
                    <option value="desc" ${current_sort_order === "desc" ? "selected" : ""}>
                       Descending
                    </option>
                    <option value="asc" ${current_sort_order === "asc" ? "selected" : ""}>
                       Ascending 
                    </option>
                </select>

                <button class="btn btn-primary" id="create_job_btn"
                    style="padding:10px 24px; font-size:16px; border-radius:8px;">
                    Create Job
                </button>

            </div>
        </div>

        <div id="job-card-container" class="row"></div>
    `);

    // =============================
    // BUTTON EVENTS
    // =============================
    $("#back-to-sbm").on("click", () => {
        frappe.set_route("sbm");
    });

    $("#create_job_btn").on("click", () => {
        frappe.set_route("Form", "Job", "new-job");
    });

    // =============================
    // SORT CHANGE EVENT (FIXED ✅)
    // =============================
    $("#sort-order").off("change").on("change", function () {
        current_sort_order = $(this).val();  // store value
        render_job_cards();                  // re-render
    });

    // =============================
    // FETCH DATA
    // =============================
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
            order_by: `name ${current_sort_order}`, // ✅ dynamic sorting
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

                const priority_bg =
                    job.priority === "High" ? "#e74c3c" :
                    job.priority === "Medium" ? "#f39c12" :
                    job.priority === "Low" ? "#3498db" :
                    "#6c757d";

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

                            <!-- HEADER -->
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <h5 style="margin:0;">${job.name}</h5>

                                <div style="display:flex; gap:6px;">
                                    
                                    ${
                                        !is_completed
                                        ? `
                                        <span style="
                                            background:${priority_bg};
                                            color:#fff;
                                            padding:4px 10px;
                                            border-radius:20px;
                                            font-size:11px;
                                        ">
                                            ${job.priority || "No Priority"}
                                        </span>
                                        `
                                        : ``
                                    }

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
                            </div>

                            <hr>

                            <!-- BODY -->
                            <p><b>Job Type:</b> ${job.job_type || "-"}</p>
                            <p><b>Priority:</b> ${job.priority || "-"}</p>
                            <p><b>Customer:</b> ${job.customer || "-"}</p>
                            <p><b>Date:</b> ${job.date || "-"}</p>

                            <!-- ACTIONS -->
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
// VIEW TASKS PAGE
// ===================================================
function bind_task_buttons() {
    $(".view-tasks").off("click").on("click", function () {
        const job_id = $(this).data("job");
        frappe.set_route(["task-list", job_id]);
    });
}

















// frappe.pages['job-list'].on_page_load = function (wrapper) {

//     frappe.ui.make_app_page({
//         parent: wrapper,
//         title: 'Job List',
//         single_column: true
//     });

//     $(wrapper).find('.layout-main-section').html(`
//         <div id="job-list-wrapper">
//             <div id="job-content"></div>
//         </div>
//     `);

//     render_job_cards();
// };

// // ===================================================
// // RENDER JOB CARDS
// // ===================================================
// function render_job_cards() {

//     $("#job-content").html(`
//         <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">

//             <button class="btn btn-outline-secondary" id="back-to-sbm" style="
// 				background-color: black;
// 				color: white;
// 				border-color: black;
// 			">
//                 ← Back to SBM
//             </button>

//             <button class="btn btn-primary" id="create_job_btn"
// 			style="
//                 padding: 10px 24px;   
//                 font-size: 16px;      
//                 border-radius: 8px;   
//             ">
//                 Create Job
//             </button>
//         </div>

//         <div id="job-card-container" class="row"></div>
//     `);

//     $("#back-to-sbm").on("click", () => {
//         frappe.set_route("sbm");
//     });

//     $("#create_job_btn").on("click", () => {
//         frappe.set_route("Form", "Job", "new-job");
//     });

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

//             const container = $("#job-card-container");
//             container.empty();

//             if (!r.message || r.message.length === 0) {
//                 container.html("<p>No jobs found</p>");
//                 return;
//             }

//             r.message.forEach(job => {

//                 const is_completed = job.status === "Completed";
//                 const card_bg = is_completed ? "#e9f7ef" : "#ffffff";
//                 const border_color = is_completed ? "#2ecc71" : "#e0e0e0";
//                 const status_bg = is_completed ? "#2ecc71" : "#6c757d";

//                 container.append(`
//                     <div class="col-md-4">
//                         <div class="job-card" style="
//                             background:${card_bg};
//                             border:1px solid ${border_color};
//                             border-radius:12px;
//                             padding:16px;
//                             margin-bottom:18px;
//                             box-shadow:0 6px 16px rgba(0,0,0,0.08);
//                         ">

//                             <div style="display:flex; justify-content:space-between;">
//                                 <h5>${job.name}</h5>
//                                 <span style="
//                                     background:${status_bg};
//                                     color:#fff;
//                                     padding:4px 10px;
//                                     border-radius:20px;
//                                     font-size:11px;
//                                 ">
//                                     ${job.status}
//                                 </span>
//                             </div>

//                             <hr>

//                             <p><b>Job Type:</b> ${job.job_type || "-"}</p>
//                             <p><b>Priority:</b> ${job.priority || "-"}</p>
//                             <p><b>Customer:</b> ${job.customer || "-"}</p>
//                             <p><b>Date:</b> ${job.date || "-"}</p>

//                             <div style="display:flex; gap:8px;">
//                                 <button class="btn btn-sm btn-primary open-job"
//                                     data-job="${job.name}">
//                                     Open Job
//                                 </button>

//                                 <button class="btn btn-sm btn-outline-secondary view-tasks"
//                                     data-job="${job.name}">
//                                     View Tasks
//                                 </button>
//                             </div>
//                         </div>
//                     </div>
//                 `);
//             });

//             bind_job_buttons();
//             bind_task_buttons();
//         }
//     });
// } 

// // ===================================================
// // OPEN JOB FORM
// // ===================================================
// function bind_job_buttons() {
//     $(".open-job").off("click").on("click", function () {
//         frappe.set_route("Form", "Job", $(this).data("job"));
//     });
// }

// // ===================================================
// // LOAD TASKS TABLE (SAME PAGE)
// // ===================================================


// function bind_task_buttons() {
//     $(".view-tasks").off("click").on("click", function () {
//         const job_id = $(this).data("job");

//         // Pass the Job name in the route
//         frappe.set_route(["task-list", job_id]);
//     });
// }


