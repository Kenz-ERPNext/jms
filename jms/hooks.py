app_name = "jms"
app_title = "SBM"
app_publisher = "sammish"
app_description = "Job Management System"
app_email = "sammish.thundiyil@gmail.com"
app_license = "mit"
 
# Apps
# ------------------

# required_apps = []

# Each item in the list will be shown as an app in the apps page
add_to_apps_screen = [
	{
		"name": "jms",
		"logo": "/assets/jms/images/kenz-mark.png",
		"title": "SBM Dashboard",
		"route": "/sbm",
		"has_permission": "jms.api.has_app_permission",
	}
]

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/jms/css/jms.css"
app_include_js = "/assets/jms/js/jms.js"

# include js, css files in header of web template
# web_include_css = "/assets/jms/css/jms.css"
# web_include_js = "/assets/jms/js/jms.js"

# include custom scss in every website theme (without file extension ".scss")
# website_theme_scss = "jms/public/scss/website"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {"doctype" : "public/js/doctype.js"}
# doctype_list_js = {"doctype" : "public/js/doctype_list.js"}
# doctype_tree_js = {"doctype" : "public/js/doctype_tree.js"}
# doctype_calendar_js = {"doctype" : "public/js/doctype_calendar.js"}

# Svg Icons
# ------------------
# include app icons in desk
# app_include_icons = "jms/public/icons.svg"

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {
# 	"Role": "home_page"
# }

# SBM frontend (React): every /sbm/... path loads jms/www/sbm.html, React handles the route.
website_route_rules = [
	{"from_route": "/sbm/<path:app_path>", "to_route": "sbm"},
]

# ERPNext's /login shows the SBM login page (/login?desk=1 still opens ERPNext's).
page_renderer = ["jms.sbm_login.SBMLoginPage"]

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Jinja
# ----------

# add methods and filters to jinja environment
# jinja = {
# 	"methods": "jms.utils.jinja_methods",
# 	"filters": "jms.utils.jinja_filters"
# }

# Installation
# ------------

# before_install = "jms.install.before_install"
# after_install = "jms.install.after_install"

# Uninstallation
# ------------

# before_uninstall = "jms.uninstall.before_uninstall"
# after_uninstall = "jms.uninstall.after_uninstall"

# Integration Setup
# ------------------
# To set up dependencies/integrations with other apps
# Name of the app being installed is passed as an argument

# before_app_install = "jms.utils.before_app_install"
# after_app_install = "jms.utils.after_app_install"

# Integration Cleanup
# -------------------
# To clean up dependencies/integrations with other apps
# Name of the app being uninstalled is passed as an argument

# before_app_uninstall = "jms.utils.before_app_uninstall"
# after_app_uninstall = "jms.utils.after_app_uninstall"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "jms.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

permission_query_conditions = {
	"Job": "jms.events.job_query_conditions",
}

has_permission = {
	"Job": "jms.events.job_has_permission",
}

# DocType Class
# ---------------
# Override standard doctype classes

# override_doctype_class = {
# 	"ToDo": "custom_app.overrides.CustomToDo"
# }

# Document Events
# ---------------
# Hook on document methods and events

doc_events = {
	"*": {
		"on_cancel": [
			"jms.events.log_cancelled_document",
			"jms.accounting_log.log_accounting_change",
		],
		"on_update": [
			"jms.events.log_cancelled_document",
			"jms.events.log_updated_document",
			"jms.accounting_log.log_accounting_change",
		],
		"after_insert": "jms.accounting_log.log_accounting_change",
		"on_submit": "jms.accounting_log.log_accounting_change",
		"on_update_after_submit": "jms.accounting_log.log_accounting_change",
		"on_trash": "jms.accounting_log.log_accounting_change",
	},
	# before_insert: an amendment made through SBM (jms/api/amend.py)
	"Sales Invoice": {
		"before_insert": "jms.api.amend.set_amended_from",
		"on_submit": "jms.events.on_sales_invoice_submit",
		"on_cancel": "jms.events.on_sales_invoice_cancel",
	},
	"Purchase Invoice": {
		"before_insert": "jms.api.amend.set_amended_from",
		"on_submit": "jms.events.on_purchase_invoice_submit",
		"on_cancel": "jms.events.on_purchase_invoice_cancel",
	},
	"Payment Entry": {
		"before_insert": "jms.api.amend.set_amended_from",
		"on_cancel": "jms.events.on_payment_entry_cancel",
	},
}

# Scheduled Tasks
# ---------------

# scheduler_events = {
# 	"all": [
# 		"jms.tasks.all"
# 	],
# 	"daily": [
# 		"jms.tasks.daily"
# 	],
# 	"hourly": [
# 		"jms.tasks.hourly"
# 	],
# 	"weekly": [
# 		"jms.tasks.weekly"
# 	],
# 	"monthly": [
# 		"jms.tasks.monthly"
# 	],
# }

# Testing
# -------

before_tests = "jms.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {
# 	"frappe.desk.doctype.event.event.get_events": "jms.event.get_events"
# }
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {
# 	"Task": "jms.task.get_dashboard_data"
# }

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]

# Ignore links to specified DocTypes when deleting documents
# -----------------------------------------------------------

# ignore_links_on_delete = ["Communication", "ToDo"]
# The log keeps its rows when the document they describe is deleted.
ignore_links_on_delete = ["Accounting Change Log"]

# Request Events
# ----------------
# Compat shim for frappe<->erpnext version skew (round_floats_in). No-op once
# frappe is updated to match erpnext. See jms/compat.py.
before_request = [
	"jms.compat.patch_round_floats_in",
	# only System Managers and Admins may open the ERPNext desk; others go to SBM
	"jms.desk_access.block_desk",
]
# after_request = ["jms.utils.after_request"]

# Job Events
# ----------
# before_job = ["jms.utils.before_job"]
# after_job = ["jms.utils.after_job"]

# User Data Protection
# --------------------

# user_data_fields = [
# 	{
# 		"doctype": "{doctype_1}",
# 		"filter_by": "{filter_by}",
# 		"redact_fields": ["{field_1}", "{field_2}"],
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_2}",
# 		"filter_by": "{filter_by}",
# 		"partial": 1,
# 	},
# 	{
# 		"doctype": "{doctype_3}",
# 		"strict": False,
# 	},
# 	{
# 		"doctype": "{doctype_4}"
# 	}
# ]

# Authentication and authorization
# --------------------------------

# auth_hooks = [
# 	"jms.auth.validate"
# ]

# Automatically update python controller files with type annotations for this app.
# export_python_type_annotations = True

# default_log_clearing_doctypes = {
# 	"Logging DocType Name": 30  # days to retain logs
# }



doctype_js = {
    
    "Purchase Invoice": "public/js/purchase_invoice.js",

   
    }



fixtures = [
    {
        "doctype": "Custom Field",
        "filters": [
            [
                "name",
                "in",

                [

                "Customer-custom_agent",
                "Supplier-custom_outsourced_party",
                "Sales Invoice-custom_job",
                "Payment Entry-custom_job",
                "Task-custom_job",
                "Company-custom_purchase_taxes_and_charges_template",
                "Purchase Invoice-custom_job",
                "Customer-custom_phone_number",
                "Customer-custom_iqama_no"
         
 
                
              
                 ]
            ]
        ]
    },
    {"dt":"Property Setter",
				"filters": [
					["name", "in",[
                        # "Purchase Receipt-main-field_order",
                        

                    ]]
				]
			},
    {
        "doctype": "Role",
        "filters": [
            ["name", "in", ["Admin", "Task Staff"]]
        ]
    },
    {
        "doctype": "Print Format",
        "filters": [
            ["name", "in", ["Job Print Format"]]
        ]
    },
]