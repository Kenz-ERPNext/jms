<template>
  <aside v-if="canRead" class="accounting-feed flex flex-col rounded-lg border border-gray-200 bg-white" :style="{ maxHeight }" ref="box">
    <header class="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-2.5">
      <div class="flex items-center gap-2 text-sm font-medium text-gray-900">
        Accounting Activity
        <span class="flex items-center gap-1 text-xs font-semibold text-green-600" title="New changes appear here automatically">
          <span class="h-2 w-2 animate-pulse rounded-full bg-green-500" />Live
        </span>
      </div>
      <a href="/app/accounting-activity" class="text-xs text-gray-500 hover:text-gray-900" @click.prevent="openAll">View all</a>
    </header>

    <div class="flex-1 overflow-y-auto">
      <div v-if="log.loading && !rows.length" class="space-y-3 p-4">
        <div v-for="i in 5" :key="i" class="h-12 animate-pulse rounded bg-gray-100" />
      </div>
      <div v-else-if="log.error" class="p-4 text-sm text-red-600">
        {{ log.error.messages?.[0] || log.error.message }}
      </div>
      <div v-else-if="!rows.length" class="flex flex-col items-center gap-2 p-10 text-gray-500">
        <FeatherIcon name="book-open" class="h-7 w-7 text-gray-300" />
        <span class="text-sm">No accounting changes yet</span>
      </div>
      <ol v-else class="m-0 list-none py-1 pl-0 pr-0">
        <li
          v-for="(row, i) in rows"
          :key="row.name"
          :data-log="row.name"
          class="accounting-entry relative flex gap-3 px-4 py-3"
          :class="{ 'fresh-entry': row.name === fresh }"
        >
          <!-- timeline: a line from this dot down to the next one; the dot sits on
               the first line of text and is coloured by the action -->
          <span v-if="i < rows.length - 1" class="absolute left-5 top-[22px] -bottom-[22px] w-0.5 bg-gray-200" />
          <span class="relative z-[1] mt-[5px] h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-white" :class="actionOf(row).dot" />
          <div class="min-w-0 flex-1">
            <div class="flex items-start justify-between gap-2">
              <p class="text-sm text-gray-700">
                <span class="font-semibold text-gray-900">{{ row.changed_by_name || row.changed_by }}</span>
                {{ actionOf(row).verb }} {{ row.reference_doctype }}
                <a
                  v-if="row.action !== 'Deleted'"
                  :href="docUrl(row)"
                  class="font-medium text-gray-900 underline decoration-gray-300 underline-offset-2 hover:decoration-gray-700"
                  @click.prevent="openDoc(row)"
                >{{ row.reference_name }}</a>
                <span v-else class="font-medium text-gray-900">{{ row.reference_name }}</span>
                <template v-if="row.party"> for {{ row.party }}</template>
              </p>
              <span v-if="row.amount" class="shrink-0 text-sm font-semibold text-gray-900">{{ money(row) }}</span>
            </div>
            <div class="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
              <span class="rounded px-1.5 py-px font-medium" :class="actionOf(row).soft">{{ row.action }}</span>
              <time :title="formatDateTime(row.creation)" v-html="timeAgo(row.creation)" />
            </div>
            <template v-if="lines(row).length">
              <button class="mt-1 border-0 p-0 text-xs text-gray-500 shadow-none hover:text-gray-900" @click="toggle(row)">
                {{ open[row.name] ? 'Hide changes' : `Show ${lines(row).length} change${lines(row).length > 1 ? 's' : ''}` }}
              </button>
              <ul v-if="open[row.name]" class="mt-1 list-disc space-y-0.5 pl-4 text-xs text-gray-600">
                <li v-for="(l, i) in lines(row)" :key="i" class="break-words">{{ l }}</li>
              </ul>
            </template>
          </div>
        </li>
      </ol>
    </div>
  </aside>
</template>

<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { createResource, FeatherIcon } from '@/frappe'
import { TONES, formatDateTime, timeAgo } from '@/status'

// Latest entries of the Accounting Change Log (jms/accounting_log.py). New
// entries are pushed over the desk's realtime socket, the same way the
// Accounting Activity page receives them.
const LOG = 'Accounting Change Log'
const EVENT = 'accounting_change_log'
const LIMIT = 20

const ACTIONS = {
  Created: { verb: 'created', tone: 'blue' },
  Amended: { verb: 'created an amendment of', tone: 'blue' },
  Edited: { verb: 'edited', tone: 'orange' },
  'Edited after Submit': { verb: 'edited submitted', tone: 'orange' },
  Submitted: { verb: 'submitted', tone: 'green' },
  Cancelled: { verb: 'cancelled', tone: 'red' },
  Deleted: { verb: 'deleted', tone: 'red' },
}

const canRead = window.frappe?.model?.can_read(LOG)
const rows = ref([])
const fresh = ref(null)
const open = reactive({})

const log = createResource({
  url: 'frappe.client.get_list',
  params: {
    doctype: LOG,
    fields: ['name', 'creation', 'action', 'reference_doctype', 'reference_name', 'changed_by',
      'changed_by_name', 'party', 'amount', 'currency', 'details'],
    order_by: 'creation desc',
    limit_page_length: LIMIT,
  },
  auto: canRead,
  onSuccess(data) {
    rows.value = data
  },
})

function onChange(row) {
  if (!row || rows.value.some((r) => r.name === row.name)) return
  rows.value = [row, ...rows.value].slice(0, LIMIT)
  fresh.value = row.name
}

function actionOf(row) {
  const a = ACTIONS[row.action] || { verb: 'changed', tone: 'gray' }
  return { ...a, dot: TONES[a.tone].bar, soft: TONES[a.tone].soft }
}

function lines(row) {
  return (row.details || '').split('\n').filter(Boolean)
}

function toggle(row) {
  open[row.name] = !open[row.name]
}

function money(row) {
  return window.format_currency ? window.format_currency(row.amount, row.currency) : row.amount
}

function docUrl(row) {
  return `/app/${window.frappe.router.slug(row.reference_doctype)}/${encodeURIComponent(row.reference_name)}`
}

function openDoc(row) {
  window.frappe.set_route('Form', row.reference_doctype, row.reference_name)
}

function openAll() {
  window.frappe.set_route('accounting-activity')
}

// The panel fills the rest of the window next to the job list.
const box = ref(null)
const maxHeight = ref('70vh')
function measure() {
  if (!box.value || window.innerWidth < 1024) {
    maxHeight.value = '32rem'
    return
  }
  const top = box.value.getBoundingClientRect().top + window.scrollY
  maxHeight.value = Math.max(320, window.innerHeight - top - 24) + 'px'
}

onMounted(() => {
  if (!canRead) return
  // Frappe only lets a browser into this room when the user may read the log.
  window.frappe.realtime.doctype_subscribe(LOG)
  window.frappe.realtime.on(EVENT, onChange)
  measure()
  window.addEventListener('resize', measure)
})
onBeforeUnmount(() => {
  if (!canRead) return
  window.frappe.realtime.off(EVENT, onChange)
  window.removeEventListener('resize', measure)
})
</script>

<style scoped>
.fresh-entry {
  animation: fresh 2.5s ease-out;
}
@keyframes fresh {
  from {
    background: #fef9c3;
  }
  to {
    background: transparent;
  }
}
</style>
