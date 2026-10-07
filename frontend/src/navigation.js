// The desk owns the address bar, so screens are opened through Frappe's router:
//   /app/jms-dashboard            -> dashboard
//   /app/jms-dashboard/<job name> -> that job
// The desk page (jms_dashboard.js) then tells the Vue router which screen to show,
// so a refresh, a shared link or the browser Back button land on the right screen.
export const PAGE = 'jms-dashboard'

export function openJob(name) {
  window.frappe.set_route(PAGE, name)
}

export function openDashboard() {
  window.frappe.set_route(PAGE)
}

// Vue route for the current desk route
export function routeFromDesk() {
  const [page, ...rest] = window.frappe.get_route()
  if (page !== PAGE || !rest.length) return { name: 'Dashboard' }
  return { name: 'JobDetail', params: { name: rest.join('/') } }
}
