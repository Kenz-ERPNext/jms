frappe.pages['sbm'].on_page_load = function (wrapper) {

    frappe.ui.make_app_page({
        parent: wrapper,
        title: "",
        single_column: true
    });

    // ===================================================
    // PAGE LAYOUT
    // ===================================================
    $(wrapper).find('.layout-main-section').html(`

        <!-- HEADER -->
        <div class="sbm-portal-header">
            <h1>Service Business Management</h1>
            <p>Powered By KENZ Technology</p>
        </div>

        <div class="sbm-wrapper">

            <!-- SIDEBAR -->
            <div class="sbm-sidebar">

                <link rel="stylesheet"
                    href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">

                <h4 class="SBM">
                    SBM Menu
                    <i class="fa fa-chevron-down"></i>
                </h4>

                <div class="sbm-menu-items">

                    <!-- ================= MASTER DATAS ================= -->
                    <div class="sbm-section-title">MASTER DATAS</div>

                    <div class="sbm-menu-item" data-route="Customer">
                        <span>Customers</span><i class="fa fa-user"></i>
                    </div>

                    <div class="sbm-menu-item" data-route="Agent">
                        <span>Agents</span><i class="fa fa-users"></i>
                    </div>

                    <div class="sbm-menu-item" data-route="Job Type">
                        <span>Job Type</span><i class="fa fa-tags"></i>
                    </div>

                    <div class="sbm-menu-item" data-route="Job Source">
                        <span>Job Source</span><i class="fa fa-share-nodes"></i>
                    </div>

                    <div class="sbm-menu-item" data-route="Job Nature">
                        <span>Job Nature</span><i class="fa fa-briefcase-medical"></i>
                    </div>

                    <div class="sbm-menu-item" data-route="Work Template">
                        <span>Work Template</span><i class="fa fa-layer-group"></i>
                    </div>

                    <div class="sbm-menu-item" data-route="Employee">
                        <span>Employee</span><i class="fa fa-id-badge"></i>
                    </div>

                    <div class="sbm-menu-item" data-route="Outsourced Party">
                        <span>Outsourced Party</span><i class="fa fa-industry"></i>
                    </div>

                    <div class="sbm-menu-item" data-route="Task">
                        <span>Tasks</span><i class="fa fa-tasks"></i>
                    </div>

                    <hr>

                    <!-- ================= DOCUMENTS ================= -->
                    <div class="sbm-section-title">DOCUMENTS</div>

                    <div class="sbm-menu-item" data-route="Job">
                        <span>Job</span><i class="fa fa-briefcase"></i>
                    </div>

                    <div class="sbm-menu-item" data-route="Sales Invoice">
                        <span>Invoices</span><i class="fa fa-file-invoice-dollar"></i>
                    </div>

                    <div class="sbm-menu-item" data-route="Payment Entry">
                        <span>Payments</span><i class="fa fa-credit-card"></i>
                    </div>

                </div>
            </div>

            <!-- RIGHT CONTENT -->
            <div id="sbm-right-content">
                <div id="overview-cards"></div>
            </div>

        </div>
    `);

    // ===================================================
    // STYLES
    // ===================================================
    $("<style>").html(`
        .sbm-wrapper{
            display:flex;
            gap:20px;
            margin-top:20px;
        }

        .sbm-portal-header{
            position:sticky;
            top:0;
            z-index:1000;
            background:linear-gradient(135deg,#4e73df,#1cc88a);
            color:#fff;
            text-align:center;
            padding:20px;
            border-radius:0 0 12px 12px;
        }

        .sbm-portal-header h1{
            margin:0;
            font-size:34px;
            font-weight:800;
        }

        .sbm-portal-header p{
            margin:5px 0 0;
            font-size:12px;
            opacity:0.6;
        }

        .sbm-sidebar{
            width:260px;
            background:#f9fafb;
            padding:15px;
            border-radius:12px;
            height:calc(100vh - 200px);
            overflow:auto;
            position:sticky;
            top:120px;
        }

        .SBM{
            font-size:15px;
            font-weight:700;
            cursor:pointer;
            display:flex;
            justify-content:space-between;
            align-items:center;
            border-bottom:1px solid #ddd;
            padding-bottom:6px;
            margin-bottom:10px;
        }

        .sbm-section-title{
            font-size:11px;
            font-weight:700;
            color:#6b7280;
            margin:12px 0 6px;
            letter-spacing:1px;
        }

        .sbm-menu-item{
            display:flex;
            justify-content:space-between;
            align-items:center;
            padding:8px 12px;
            border-radius:10px;
            cursor:pointer;
            font-weight:600;
            margin-bottom:6px;
            transition:.2s;
        }

        .sbm-menu-item:hover{
            background:#000;
            color:#fff;
        }

        #sbm-right-content{
            flex:1;
            padding:10px;
        }

        #overview-cards{
            display:flex;
            flex-wrap:wrap;
            justify-content:center;
        }

        .overview-card{
            width:280px;
            height:170px;
            margin:15px;
            border-radius:20px;
            backdrop-filter:blur(15px);
            background:rgba(255,255,255,0.15);
            box-shadow:0 8px 32px rgba(31,38,135,.37);
            color:#fff;
            text-align:center;
            padding:25px;
            cursor:pointer;
            transition:.3s;
        }

        .overview-card:hover{
            transform:translateY(-8px) scale(1.03);
        }
    `).appendTo("head");

    // ===================================================
    // MENU EVENTS
    // ===================================================
    $(".sbm-menu-items").hide();

    $(".SBM").click(function () {
        $(".sbm-menu-items").slideToggle(200);
        $(this).find("i").toggleClass("fa-chevron-down fa-chevron-up");
    });

    $(".sbm-menu-item").click(function () {
        const dt = $(this).data("route");
        if (dt === "Job") frappe.set_route("job-list");
        else frappe.set_route("List", dt);
    });

    // ===================================================
    // LOAD OVERVIEW CARDS
    // ===================================================
    load_overview_cards();
};


// ===================================================
// OVERVIEW CARDS
// ===================================================
function load_overview_cards() {

    // Order matches sidebar exactly
    const doctypes = [
        "Customer",
        "Agent",
        "Job Type",
        "Job Source",
        "Job Nature",
        "Work Template",
        "Employee",
        "Outsourced Party",
        "Task",
        "Job",
        "Sales Invoice",
        "Payment Entry"
    ];

    $("#overview-cards").html("");

    // Create an array to store counts in order
    const cardsData = new Array(doctypes.length);

    let completed = 0;

    doctypes.forEach((dt, index) => {
        frappe.call({
            method: "frappe.client.get_list",
            args: {
                doctype: dt,
                fields: ["name"],
                limit_page_length: 0
            },
            callback: function (r) {
                const count = r.message ? r.message.length : 0;
                cardsData[index] = { doctype: dt, count: count };
                completed++;

                // Once all API calls finish, render in order
                if (completed === doctypes.length) {
                    $("#overview-cards").html(""); // clear before appending
                    cardsData.forEach(card => {
                        $("#overview-cards").append(`
                            <div class="overview-card" data-doctype="${card.doctype}">
                                <h4>${card.doctype}</h4>
                                <h1>${card.count}</h1>
                            </div>
                        `);

                        $(".overview-card").last().click(function () {
                            if (card.doctype === "Job") frappe.set_route("job-list");
                            else frappe.set_route("List", card.doctype);
                        });
                    });
                }
            }
        });
    });
}


