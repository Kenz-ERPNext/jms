import { createApp } from 'vue'
import { frappeRequest, setConfig } from '@/frappe'

import App from './App.vue'
import { createDashboardRouter } from './router'
import { PAGE, routeFromDesk } from './navigation'
import './index.css'

setConfig('resourceFetcher', frappeRequest)

// Called by the desk page (jms/jms/page/jms_dashboard/jms_dashboard.js).
export function mount(el) {
  // frappeRequest reads the CSRF token from window.csrf_token
  window.csrf_token = window.frappe?.csrf_token
  const router = createDashboardRouter()
  const app = createApp(App)
  app.use(router)
  app.mount(el)

  // follow the desk route (see navigation.js)
  const sync = () => {
    if (window.frappe.get_route()[0] === PAGE) router.replace(routeFromDesk())
  }
  sync()
  window.frappe.router.on('change', sync)
  return app
}
