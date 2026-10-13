<template>
  <div>
    <div>
    <!-- number cards, like the desk's Number Cards -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <button
        v-for="key in cardKeys"
        :key="key"
        :data-card="key"
        :aria-pressed="activeCard === key"
        class="number-card rounded-lg border bg-white px-4 py-3 text-left transition hover:border-gray-300 focus:outline-none"
        :class="activeCard === key ? 'border-gray-800 shadow-sm' : 'border-gray-200'"
        @click="selectCard(key)"
      >
        <div class="flex items-center justify-between text-sm text-gray-600">
          <span class="flex items-center gap-2">
            <span class="h-2 w-2 rounded-full" :class="TONES[STATUSES[key].tone].bar" />
            {{ STATUSES[key].label }}
          </span>
          <span v-if="key !== 'all' && counts.data" class="text-xs text-gray-400">
            {{ pct(counts.data[key], counts.data.all) }}%
          </span>
        </div>
        <div class="mt-2 text-2xl font-semibold text-gray-900">
          <span v-if="counts.loading" class="inline-block h-7 w-14 animate-pulse rounded bg-gray-100" />
          <template v-else>{{ (counts.data?.[key] ?? 0).toLocaleString() }}</template>
        </div>
        <div class="mt-0.5 text-xs text-gray-400">
          {{ (counts.data?.tasks?.[key] ?? 0).toLocaleString() }} tasks
        </div>
      </button>
    </div>

    </div>

    <!-- jobs on the left, live accounting activity on the right (below on small screens) -->
    <div class="mt-5 flex flex-col gap-4 lg:flex-row lg:items-start">
    <div class="min-w-0 flex-1">
    <!-- jobs list, like the desk's list view -->
    <div class="flex flex-wrap items-center justify-between gap-3 rounded-t-lg border border-gray-200 bg-white px-4 py-2.5">
        <div class="flex flex-wrap items-center gap-1">
          <button
            v-for="key in cardKeys"
            :key="key"
            class="rounded-md border-0 px-2.5 py-1 text-sm shadow-none transition"
            :class="activeCard === key ? 'bg-gray-100 font-medium text-gray-900' : 'text-gray-500 hover:text-gray-900'"
            @click="selectCard(key, true)"
          >
            {{ key === 'all' ? 'All jobs' : STATUSES[key].label }}
          </button>
        </div>
        <div class="relative w-full sm:w-64">
          <FeatherIcon name="search" class="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" />
          <input
            v-model="search"
            type="search"
            placeholder="Search job, title or customer"
            class="w-full rounded-md border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-3 text-sm outline-none transition focus:border-gray-400 focus:bg-white"
          />
        </div>
        <!-- second line: job count on the left, List / Cards under the search -->
        <div class="flex w-full items-center justify-between border-t border-gray-100 pt-2.5">
          <span class="text-xs text-gray-500">{{ total.toLocaleString() }} jobs</span>
        <div class="flex rounded-md bg-gray-100 p-0.5 text-sm">
          <button
            v-for="v in VIEWS"
            :key="v.key"
            :data-view="v.key"
            :title="v.label"
            class="flex items-center gap-1.5 rounded border-0 px-2.5 py-1 shadow-none transition"
            :class="view === v.key ? 'bg-white font-medium text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'"
            @click="setView(v.key)"
          >
            <FeatherIcon :name="v.icon" class="h-3.5 w-3.5" />{{ v.label }}
          </button>
        </div>
        </div>
      </div>

    <!-- the job list scrolls inside its own box; cards and tabs stay in view -->
    <section
      ref="listBox"
      class="overflow-y-auto rounded-b-lg border border-t-0 border-gray-200 bg-white"
      :style="{ maxHeight: listMaxHeight }"
    >
      <div v-if="jobs.error" class="p-6 text-sm text-red-600">
        {{ jobs.error.messages?.[0] || jobs.error.message }}
      </div>
      <div v-else-if="!rows.length && jobs.loading" class="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        <div v-for="i in 6" :key="i" class="h-32 animate-pulse rounded-lg bg-gray-100" />
      </div>
      <div v-else-if="!rows.length" class="px-4 py-12 text-center text-sm text-gray-500">
        <FeatherIcon name="inbox" class="mx-auto mb-2 h-7 w-7 text-gray-300" />
        No jobs found
      </div>
      <table v-else-if="view === 'list'" class="w-full text-sm">
        <thead class="sticky top-0 z-10">
          <tr class="border-b border-gray-200 bg-gray-50 text-left text-xs text-gray-500">
            <th class="w-10 py-2 pl-3" />
            <th class="px-4 py-2 font-medium">Job</th>
            <th class="px-4 py-2 font-medium">Customer</th>
            <th class="px-4 py-2 font-medium">Status</th>
            <th class="w-56 px-4 py-2 font-medium">Tasks</th>
            <th class="px-4 py-2 font-medium">Pending</th>
            <th class="px-4 py-2 text-right font-medium">Expected by</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="job in rows" :key="job.name">
          <tr
            :data-job="job.name"
            class="job-card cursor-pointer border-b border-gray-100 transition hover:bg-gray-50"
            :class="{ 'bg-gray-50': expanded === job.name }"
            @click="toggle(job)"
          >
            <td class="py-2.5 pl-3">
              <button
                class="expand-toggle flex h-6 w-6 items-center justify-center rounded border border-gray-200 bg-white text-gray-500 shadow-none transition hover:border-gray-400 hover:text-gray-800"
                :title="expanded === job.name ? 'Hide tasks' : 'Show tasks'"
              >
                <FeatherIcon :name="expanded === job.name ? 'minus' : 'plus'" class="h-4 w-4" />
              </button>
            </td>
            <td class="px-4 py-2.5">
              <div class="font-medium text-gray-900">{{ job.job_title }}</div>
              <div class="text-xs text-gray-400">{{ job.name }}</div>
            </td>
            <td class="max-w-[14rem] truncate px-4 py-2.5 text-gray-600">{{ job.customer_name || job.customer || '—' }}</td>
            <td class="px-4 py-2.5"><JobBadge :status="job.status" /></td>
            <td class="px-4 py-2.5">
              <div class="flex items-center gap-2">
                <div class="flex h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div class="bg-green-500" :style="{ width: pct(job.completed, job.task_total) + '%' }" />
                  <div class="bg-violet-500" :style="{ width: pct(job.in_progress, job.task_total) + '%' }" />
                  <div class="bg-orange-500" :style="{ width: pct(job.pending, job.task_total) + '%' }" />
                </div>
                <span class="w-10 text-right text-xs text-gray-500">{{ job.completed }}/{{ job.task_total }}</span>
              </div>
            </td>
            <td class="px-4 py-2.5">
              <span v-if="job.pending" class="indicator-pill orange">{{ job.pending }}</span>
              <span v-else class="text-gray-300">—</span>
            </td>
            <td class="px-4 py-2.5 text-right" :class="isOverdue(job) ? 'text-red-500' : 'text-gray-600'">
              {{ formatDate(job.expected_completion_date) || '—' }}
              <div v-if="isOverdue(job)" class="text-xs">Overdue</div>
            </td>
          </tr>
          <!-- tasks of the expanded job (one job open at a time) -->
          <tr v-if="expanded === job.name" class="job-tasks border-b border-gray-100 bg-gray-50">
            <td />
            <td colspan="6" class="px-4 pb-4 pt-1">
              <div v-if="taskList.loading && !taskList.data" class="flex items-center gap-2 py-3 text-sm text-gray-400">
                <span class="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-gray-600" />
                Loading tasks...
              </div>
              <div v-else-if="taskList.error" class="py-3 text-sm text-red-600">
                {{ taskList.error.messages?.[0] || taskList.error.message }}
              </div>
              <div v-else-if="!jobTasks.length" class="py-3 text-sm text-gray-400">No tasks on this job</div>
              <div v-else class="overflow-hidden rounded-md border border-gray-200 bg-white">
                <div
                  v-for="task in jobTasks"
                  :key="task.name"
                  class="expanded-task flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-gray-100 px-3 py-2 last:border-b-0"
                >
                  <span class="w-5 text-xs text-gray-400">{{ task.idx }}</span>
                  <span class="min-w-[12rem] flex-1 font-medium text-gray-800">{{ task.task_name }}</span>
                  <span class="w-44 truncate text-gray-500">
                    <template v-if="task.employee_name">{{ task.employee_name }}</template>
                    <template v-else-if="task.assigned_tos">{{ task.assigned_tos }} (Outsource)</template>
                    <span v-else class="text-gray-400">Unassigned</span>
                  </span>
                  <span class="w-28"><StatusPill :status="task.status" /></span>
                  <div v-if="task.status === 'Pending'" class="pending-reason w-full pl-9">
                    <div class="flex items-start gap-2.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2">
                      <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                        <FeatherIcon name="pause" class="h-3 w-3" />
                      </span>
                      <div class="min-w-0">
                        <div class="text-[11px] font-semibold uppercase tracking-wide text-orange-600">Why it is pending</div>
                        <div class="text-sm" :class="task.pending_reason ? 'text-gray-800' : 'italic text-gray-400'">
                          {{ task.pending_reason || 'No reason given' }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </td>
          </tr>
          </template>
        </tbody>
      </table>
      <div v-else class="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
        <div
          v-for="job in rows"
          :key="job.name"
          :data-job="job.name"
          class="job-card flex cursor-pointer flex-col rounded-lg border border-gray-200 bg-white p-4 transition hover:border-gray-400"
          @click="open(job)"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <div class="truncate font-medium text-gray-900">{{ job.job_title }}</div>
              <div class="truncate text-xs text-gray-400">{{ job.name }} · {{ job.customer_name || job.customer || '—' }}</div>
            </div>
            <JobBadge :status="job.status" />
          </div>

          <div class="mt-4 flex items-center gap-2">
            <div class="flex h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div class="bg-green-500" :style="{ width: pct(job.completed, job.task_total) + '%' }" />
              <div class="bg-violet-500" :style="{ width: pct(job.in_progress, job.task_total) + '%' }" />
              <div class="bg-orange-500" :style="{ width: pct(job.pending, job.task_total) + '%' }" />
            </div>
            <span class="text-xs text-gray-500">{{ job.completed }}/{{ job.task_total }} done</span>
          </div>

          <div class="mt-3 flex items-center justify-between gap-2 text-xs">
            <div class="flex flex-wrap gap-1.5">
              <span v-if="job.pending" class="indicator-pill orange">{{ job.pending }} pending</span>
              <span v-if="job.in_progress" class="indicator-pill purple">{{ job.in_progress }} in progress</span>
              <span v-if="job.open" class="indicator-pill blue">{{ job.open }} open</span>
              <span v-if="!job.task_total" class="text-gray-400">No tasks</span>
            </div>
            <span v-if="job.expected_completion_date" class="shrink-0" :class="isOverdue(job) ? 'text-red-500' : 'text-gray-400'">
              {{ isOverdue(job) ? 'Overdue · ' : '' }}{{ formatDate(job.expected_completion_date) }}
            </span>
          </div>
        </div>
      </div>

      <!-- infinite scroll: more jobs load when this comes into view -->
      <div ref="sentinel" class="flex h-14 items-center justify-center gap-2 text-sm text-gray-400">
        <template v-if="loadingMore">
          <span class="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-gray-600" />
          Loading more jobs...
        </template>
        <template v-else-if="rows.length && rows.length >= total">All {{ total.toLocaleString() }} jobs shown</template>
      </div>
    </section>
    </div>

    <AccountingFeed class="lg:w-80 lg:shrink-0 2xl:w-96" />
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { openJob } from '@/navigation'
import { createResource, FeatherIcon } from '@/frappe'
import JobBadge from '@/components/JobBadge.vue'
import StatusPill from '@/components/StatusPill.vue'
import AccountingFeed from '@/components/AccountingFeed.vue'
import { STATUSES, TONES, formatDate } from '@/status'

const PAGE = 21 // 7 rows of 3 cards

// List by default; the last choice is remembered in this browser.
const VIEWS = [
  { key: 'list', label: 'List', icon: 'list' },
  { key: 'cards', label: 'Cards', icon: 'grid' },
]
const VIEW_KEY = 'jms-dashboard-job-view'
function savedView() {
  try {
    return localStorage.getItem(VIEW_KEY) === 'cards' ? 'cards' : 'list'
  } catch (e) {
    return 'list'
  }
}
const view = ref(savedView())
function setView(key) {
  view.value = key
  try {
    localStorage.setItem(VIEW_KEY, key)
  } catch (e) {
    /* private mode: keep it for this visit */
  }
}
const cardKeys = ['all', 'open', 'in_progress', 'pending', 'completed']
const activeCard = ref('all')
const search = ref('')
const rows = ref([])
const total = ref(0)

const counts = createResource({ url: 'jms.api.job_status_counts', auto: true })

const jobs = createResource({
  url: 'jms.api.job_cards',
  onSuccess(data) {
    rows.value = jobs.params.start ? [...rows.value, ...data.jobs] : data.jobs
    total.value = data.total
  },
})

function params(start = 0) {
  return {
    status: activeCard.value === 'all' ? null : STATUSES[activeCard.value].value,
    search: search.value || null,
    start,
    page_length: PAGE,
  }
}

function reload() {
  expanded.value = null
  if (listBox.value) listBox.value.scrollTop = 0
  jobs.submit(params(0))
}

// Keep the loader on screen for a moment so the user sees that more is coming.
const MIN_LOADING_MS = 600
const loadingMore = ref(false)
async function loadMore() {
  if (loadingMore.value || jobs.loading || rows.value.length >= total.value) return
  loadingMore.value = true
  const started = Date.now()
  try {
    await jobs.submit(params(rows.value.length))
    await new Promise((r) => setTimeout(r, Math.max(0, MIN_LOADING_MS - (Date.now() - started))))
  } finally {
    loadingMore.value = false
  }
}

// The list box fills the rest of the window, so the page itself does not scroll.
const listBox = ref(null)
const listMaxHeight = ref('70vh')
function measureList() {
  if (!listBox.value) return
  const top = listBox.value.getBoundingClientRect().top + window.scrollY
  listMaxHeight.value = Math.max(320, window.innerHeight - top - 24) + 'px'
}

const sentinel = ref(null)
let observer
onMounted(() => {
  observer = new IntersectionObserver((entries) => entries[0].isIntersecting && loadMore(), {
    root: listBox.value,
    rootMargin: '0px 0px 40px 0px',
  })
  observer.observe(sentinel.value)
  measureList()
  window.addEventListener('resize', measureList)
})
onBeforeUnmount(() => {
  observer && observer.disconnect()
  window.removeEventListener('resize', measureList)
})

function selectCard(key, exact = false) {
  activeCard.value = exact || activeCard.value !== key ? key : 'all'
  reload()
}

function isOverdue(job) {
  return job.overdue_status && job.overdue_status !== 'On Time'
}

// List view: one job's tasks can be shown under its row; opening another closes it.
const expanded = ref(null)
const taskList = createResource({ url: 'jms.api.job_tasks' })
const jobTasks = computed(() =>
  taskList.data && taskList.data.job && taskList.data.job.name === expanded.value ? taskList.data.tasks : []
)
function toggle(job) {
  if (expanded.value === job.name) {
    expanded.value = null
    return
  }
  expanded.value = job.name
  taskList.submit({ job: job.name })
}

function open(job) {
  openJob(job.name)
}

let timer
watch(search, () => {
  clearTimeout(timer)
  timer = setTimeout(reload, 300)
})

function pct(part, whole) {
  return whole ? Math.round((part / whole) * 100) : 0
}

reload()
</script>
