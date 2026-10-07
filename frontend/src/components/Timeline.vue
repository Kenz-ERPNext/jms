<template>
  <div v-if="!events.length" class="flex flex-col items-center gap-2 p-10 text-gray-500">
    <FeatherIcon name="clock" class="h-8 w-8 text-gray-300" />
    <span class="text-sm">No changes recorded yet</span>
  </div>
  <ol v-else class="px-5 py-5">
    <li v-for="(e, i) in events" :key="i" class="timeline-event relative flex gap-3 pb-6 last:pb-0">
      <!-- connector line -->
      <span v-if="i < events.length - 1" class="absolute left-4 top-9 -ml-px h-[calc(100%-2.25rem)] w-0.5 bg-gray-100" />

      <span class="relative z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white" :class="iconClass(e)">
        <FeatherIcon :name="iconName(e)" class="h-4 w-4" />
      </span>

      <div class="min-w-0 flex-1 pt-1">
        <div class="flex flex-wrap items-baseline justify-between gap-x-3">
          <p class="text-sm text-gray-700">
            <span class="font-semibold text-gray-900">{{ e.actor_name || e.actor || 'Someone' }}</span>
            <template v-if="e.kind === 'status'">
              moved <span class="font-medium text-gray-900">{{ e.task }}</span> to
            </template>
            <template v-else-if="e.kind === 'job_status'"> changed the job status to</template>
            <template v-else-if="e.kind === 'row_added'">
              added {{ e.task ? '' : 'a row to' }} <span class="font-medium text-gray-900">{{ e.task || e.field_label }}</span>
            </template>
            <template v-else-if="e.kind === 'row_removed'">
              removed <span class="font-medium text-gray-900">{{ e.task || 'a row from ' + e.field_label }}</span>
            </template>
            <template v-else>
              changed <span class="font-medium text-gray-900">{{ e.field_label }}</span>
              <template v-if="e.task"> of <span class="font-medium text-gray-900">{{ e.task }}</span></template>
              <template v-if="e.doctype !== 'Job'"> on {{ e.doctype }} {{ e.docname }}</template>
            </template>
            <StatusPill v-if="e.kind === 'status' || e.kind === 'job_status'" :status="e.new" class="ml-1 align-middle" />
          </p>
          <!-- timeAgo returns the desk's own timestamp markup (it updates itself) -->
          <time class="shrink-0 text-xs text-gray-400" :title="formatDateTime(e.when)" v-html="timeAgo(e.when)" />
        </div>

        <p v-if="e.kind === 'status' || e.kind === 'job_status'" class="mt-0.5 text-xs text-gray-500">
          from {{ e.old || 'empty' }}
        </p>
        <p v-else-if="e.kind === 'field'" class="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
          <span class="rounded bg-gray-100 px-1.5 py-0.5 text-gray-500 line-through">{{ e.old || 'empty' }}</span>
          <FeatherIcon name="arrow-right" class="h-3 w-3 text-gray-400" />
          <span class="rounded bg-gray-100 px-1.5 py-0.5 text-gray-800">{{ e.new || 'empty' }}</span>
        </p>

        <div v-if="e.reason" class="mt-2 rounded-lg border-l-2 border-orange-400 bg-orange-50 px-3 py-2 text-sm text-orange-900">
          “{{ e.reason }}”
        </div>
      </div>
    </li>
  </ol>
</template>

<script setup>
import { FeatherIcon } from '@/frappe'
import StatusPill from '@/components/StatusPill.vue'
import { formatDateTime, timeAgo, toneOf } from '@/status'

defineProps({ events: { type: Array, default: () => [] } })

function iconName(e) {
  if (e.kind === 'status' || e.kind === 'job_status') {
    return { Pending: 'pause', Completed: 'check', 'In Progress': 'play', Cancelled: 'x', Open: 'circle' }[e.new] || 'activity'
  }
  if (e.kind === 'row_added') return 'plus'
  if (e.kind === 'row_removed') return 'minus'
  return 'edit-2'
}

function iconClass(e) {
  if (e.kind === 'status' || e.kind === 'job_status') return toneOf(e.new).icon
  if (e.kind === 'row_added') return 'bg-green-100 text-green-600'
  if (e.kind === 'row_removed') return 'bg-red-100 text-red-600'
  return 'bg-gray-100 text-gray-500'
}
</script>
