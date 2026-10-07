import { createMemoryHistory, createRouter } from 'vue-router'

import Dashboard from '@/pages/Dashboard.vue'
import JobDetail from '@/pages/JobDetail.vue'

// Memory history: the desk owns the URL (/app/jms-dashboard), so the dashboard
// keeps its own screens in memory instead of changing the address bar.
export function createDashboardRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'Dashboard', component: Dashboard },
      { path: '/jobs/:name(.*)', name: 'JobDetail', component: JobDetail, props: true },
      { path: '/:pathMatch(.*)*', redirect: '/' },
    ],
  })
}
