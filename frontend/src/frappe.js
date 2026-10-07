// Only the frappe-ui pieces the dashboard uses. Importing from the package root
// would pull in every frappe-ui component (and its icon plugin).
export { setConfig } from 'frappe-ui-src/utils/config'
export { frappeRequest } from 'frappe-ui-src/utils/frappeRequest'
export { createResource } from 'frappe-ui-src/resources/resources'
export { default as FeatherIcon } from 'frappe-ui-src/components/FeatherIcon.vue'
