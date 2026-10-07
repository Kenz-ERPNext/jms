<template>
  <div class="space-y-6">
    <a href="#" class="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900" @click.prevent="openDashboard">
      <FeatherIcon name="arrow-left" class="h-4 w-4" />
      Back to dashboard
    </a>

    <div v-if="detail.error" class="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
      {{ detail.error.messages?.[0] || detail.error.message }}
    </div>
    <div v-else-if="!data" class="space-y-4">
      <div class="h-24 animate-pulse rounded-xl bg-gray-100" />
      <div class="h-64 animate-pulse rounded-xl bg-gray-100" />
    </div>

    <template v-else>
      <!-- header -->
      <section class="rounded-lg border border-gray-200 bg-white p-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="text-sm font-medium text-gray-500">{{ data.job.name }}</div>
            <h2 class="text-xl font-semibold text-gray-900">{{ data.job.job_title }}</h2>
            <div class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
              <span class="flex items-center gap-1.5">
                <FeatherIcon name="user" class="h-3.5 w-3.5" />{{ data.job.customer_name || '—' }}
              </span>
              <span v-if="data.job.priority" class="flex items-center gap-1.5">
                <FeatherIcon name="flag" class="h-3.5 w-3.5" />{{ data.job.priority }}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <JobBadge :status="data.job.status" />
            <a
              :href="`/app/job/${encodeURIComponent(data.job.name)}`"
              class="flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1 text-sm text-gray-700 hover:bg-gray-50"
            >
              Open in Desk <FeatherIcon name="external-link" class="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        <div class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div v-for="key in ['open', 'in_progress', 'pending', 'completed']" :key="key" class="rounded-lg border border-gray-200 px-4 py-3">
            <div class="flex items-center gap-2 text-sm text-gray-600"><span class="h-2 w-2 rounded-full" :class="TONES[STATUSES[key].tone].bar" />{{ STATUSES[key].label }}</div>
            <div class="mt-1 text-2xl font-semibold text-gray-900">{{ countOf(STATUSES[key].value) }}</div>
          </div>
        </div>
      </section>

      <!-- tasks -->
      <section class="rounded-lg border border-gray-200 bg-white">
        <div class="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 class="font-semibold text-gray-900">Tasks</h3>
            <p class="text-xs text-gray-500">{{ data.tasks.length }} tasks</p>
          </div>
          <div class="flex rounded-md bg-gray-100 p-0.5 text-sm">
            <button
              v-for="v in VIEWS"
              :key="v.key"
              :data-view="v.key"
              class="flex items-center gap-1.5 rounded border-0 px-2.5 py-1 shadow-none transition"
              :class="view === v.key ? 'bg-white font-medium text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'"
              @click="setView(v.key)"
            >
              <FeatherIcon :name="v.icon" class="h-3.5 w-3.5" />{{ v.label }}
            </button>
          </div>
        </div>
        <div v-if="!data.tasks.length" class="p-8 text-center text-sm text-gray-500">No tasks on this job</div>
        <div v-if="boardError" class="mx-4 mt-4 flex items-center justify-between rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ boardError }}
          <button class="border-0 text-red-500 shadow-none" @click="boardError = ''"><FeatherIcon name="x" class="h-4 w-4" /></button>
        </div>
        <TaskBoard
          v-if="data.tasks.length && view === 'board'"
          :tasks="data.tasks"
          @changed="refresh"
          @error="(m) => (boardError = m)"
        />
        <div v-else-if="data.tasks.length" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th class="px-5 py-2.5 font-medium">#</th>
                <th class="px-5 py-2.5 font-medium">Task</th>
                <th class="px-5 py-2.5 font-medium">Assigned to</th>
                <th class="px-5 py-2.5 font-medium">Status</th>
                <th class="px-5 py-2.5 font-medium">Due</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100">
              <template v-for="task in data.tasks" :key="task.name">
                <tr :data-task="task.name" class="align-top transition hover:bg-gray-50">
                  <td class="px-5 py-3 text-gray-400">{{ task.idx }}</td>
                  <td class="px-5 py-3 font-medium text-gray-900">{{ task.task_name }}</td>
                  <td class="px-5 py-3 text-gray-600">
                    <span v-if="task.employee_name">{{ task.employee_name }}</span>
                    <span v-else-if="task.assigned_tos" class="flex items-center gap-1">
                      {{ task.assigned_tos }}
                      <span class="rounded bg-gray-100 px-1.5 text-[11px] text-gray-500">Outsource</span>
                    </span>
                    <span v-else class="text-gray-400">Unassigned</span>
                  </td>
                  <td class="px-5 py-3"><StatusPill :status="task.status" /></td>
                  <td class="px-5 py-3 text-gray-600">{{ formatDate(task.due_date) || '—' }}</td>
                </tr>
                <tr v-if="task.status === 'Pending'" class="pending-reason">
                  <td />
                  <td colspan="4" class="px-5 pb-3 pt-0">
                    <div class="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-orange-800">
                      <FeatherIcon name="alert-circle" class="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <div class="text-xs font-semibold uppercase tracking-wide">Pending reason</div>
                        <div class="text-sm">{{ task.pending_reason || 'No reason given' }}</div>
                      </div>
                    </div>
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>
      </section>

      <!-- history -->
      <section class="rounded-lg border border-gray-200 bg-white">
        <div class="border-b border-gray-100 px-5 py-4">
          <h3 class="font-semibold text-gray-900">History</h3>
          <p class="text-xs text-gray-500">Who changed what, newest first</p>
        </div>
        <Timeline :events="data.history" />
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { createResource, FeatherIcon } from '@/frappe'
import { openDashboard } from '@/navigation'
import StatusPill from '@/components/StatusPill.vue'
import Timeline from '@/components/Timeline.vue'
import TaskBoard from '@/components/TaskBoard.vue'
import JobBadge from '@/components/JobBadge.vue'
import { STATUSES, TONES, formatDate } from '@/status'

const props = defineProps({ name: String })

// Board by default; the user's last choice is remembered in this browser.
const VIEWS = [
  { key: 'board', label: 'Board', icon: 'columns' },
  { key: 'list', label: 'List', icon: 'list' },
]
const VIEW_KEY = 'jms-dashboard-task-view'
function savedView() {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'board'
  } catch (e) {
    return 'board'
  }
}
const view = ref(savedView())
function setView(key) {
  view.value = key
  try {
    localStorage.setItem(VIEW_KEY, key)
  } catch (e) {
    /* private mode: just keep it for this visit */
  }
}

const detail = createResource({ url: 'jms.api.job_tasks' })
const data = computed(() => detail.data)

function countOf(status) {
  return (data.value?.tasks || []).filter((t) => t.status === status).length
}

const boardError = ref('')
// reload quietly after a move so the counts and history are up to date
function refresh() {
  boardError.value = ''
  detail.fetch()
}

watch(
  () => props.name,
  (name) => name && detail.submit({ job: name }),
  { immediate: true },
)
</script>
