<template>
  <div class="flex gap-3 overflow-x-auto p-4">
    <div
      v-for="col in columns"
      :key="col.status"
      :data-column="col.status"
      class="flex w-64 min-w-[16rem] flex-1 flex-col rounded-lg bg-gray-50 transition"
      :class="dropTarget === col.status && dragging?.status !== col.status ? 'bg-blue-50 ring-2 ring-blue-300' : ''"
      @dragover.prevent="dropTarget = col.status"
      @dragleave="onLeave($event, col.status)"
      @drop.prevent="onDrop(col.status)"
    >
      <div class="flex items-center justify-between px-3 py-2.5">
        <span class="flex items-center gap-2 text-sm font-medium text-gray-700">
          <span class="h-2 w-2 rounded-full" :class="col.dot" />
          {{ col.status }}
        </span>
        <span class="rounded-full bg-white px-2 text-xs text-gray-500">{{ col.tasks.length }}</span>
      </div>
      <div class="flex flex-1 flex-col gap-2 px-2 pb-2">
        <div
          v-for="task in col.tasks"
          :key="task.name"
          :data-task="task.name"
          draggable="true"
          class="board-card cursor-grab rounded-md border border-gray-200 bg-white p-3 transition hover:border-gray-400 active:cursor-grabbing"
          :class="{ 'opacity-40': dragging?.name === task.name, 'pointer-events-none opacity-60': saving === task.name }"
          @dragstart="onDragStart($event, task)"
          @dragend="onDragEnd"
        >
          <div class="flex items-start justify-between gap-2">
            <span class="text-sm font-medium text-gray-900">{{ task.task_name }}</span>
            <span v-if="saving === task.name" class="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-gray-200 border-t-gray-600" />
          </div>
          <div class="mt-2 flex items-center justify-between gap-2 text-xs text-gray-500">
            <span class="flex min-w-0 items-center gap-1 truncate">
              <FeatherIcon name="user" class="h-3 w-3 shrink-0" />
              <template v-if="task.employee_name">{{ task.employee_name }}</template>
              <template v-else-if="task.assigned_tos">{{ task.assigned_tos }} (Outsource)</template>
              <span v-else class="text-gray-400">Unassigned</span>
            </span>
            <span v-if="task.due_date" class="shrink-0">{{ formatDate(task.due_date) }}</span>
          </div>
          <div
            v-if="task.status === 'Pending'"
            class="pending-reason mt-2 rounded border-l-2 border-orange-400 bg-orange-50 px-2 py-1.5 text-xs text-orange-900"
          >
            {{ task.pending_reason || 'No reason given' }}
          </div>
        </div>
        <div v-if="!col.tasks.length" class="rounded-md border border-dashed border-gray-200 py-4 text-center text-xs text-gray-400">
          No tasks
        </div>
      </div>
    </div>
  </div>

  <!-- Pending needs a reason before the move is saved -->
  <div v-if="askReason" class="fixed inset-0 z-[1050] flex items-center justify-center bg-black/30 p-4" @click.self="cancelReason">
    <div class="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
      <h4 class="font-semibold text-gray-900">Why is this task pending?</h4>
      <p class="mt-1 text-sm text-gray-500">{{ askReason.task.task_name }}</p>
      <textarea
        ref="reasonInput"
        v-model="reason"
        rows="3"
        placeholder="Pending reason"
        class="mt-3 w-full rounded-md border border-gray-200 p-2 text-sm outline-none focus:border-gray-400"
        @keydown.enter.exact.prevent="confirmReason"
      />
      <div class="mt-4 flex justify-end gap-2">
        <button class="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50" @click="cancelReason">
          Cancel
        </button>
        <button
          class="rounded-md border-0 bg-gray-900 px-3 py-1.5 text-sm text-white hover:bg-gray-700 disabled:opacity-50"
          :disabled="!reason.trim()"
          @click="confirmReason"
        >
          Set Pending
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { createResource, FeatherIcon } from '@/frappe'
import { formatDate } from '@/status'

const props = defineProps({ tasks: { type: Array, default: () => [] } })
const emit = defineEmits(['changed', 'error'])

const COLUMNS = [
  { status: 'Open', dot: 'bg-blue-500' },
  { status: 'In Progress', dot: 'bg-violet-500' },
  { status: 'Pending', dot: 'bg-orange-500' },
  { status: 'Completed', dot: 'bg-green-500' },
]

const columns = computed(() => {
  const cols = COLUMNS.map((c) => ({ ...c, tasks: props.tasks.filter((t) => t.status === c.status) }))
  // Cancelled (or any other status) only gets a column when a task has it
  const known = COLUMNS.map((c) => c.status)
  const others = [...new Set(props.tasks.map((t) => t.status).filter((s) => !known.includes(s)))]
  for (const status of others) {
    cols.push({ status: status || 'No status', dot: 'bg-red-500', tasks: props.tasks.filter((t) => t.status === status) })
  }
  return cols
})

// drag and drop: dropping a card on another column saves the new status
const dragging = ref(null)
const dropTarget = ref(null)
const saving = ref(null)

function onDragStart(event, task) {
  dragging.value = task
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', task.name)
}
function onDragEnd() {
  dragging.value = null
  dropTarget.value = null
}
function onLeave(event, status) {
  if (!event.currentTarget.contains(event.relatedTarget) && dropTarget.value === status) dropTarget.value = null
}

function onDrop(status) {
  const task = dragging.value
  onDragEnd()
  if (!task || task.status === status) return
  if (status === 'Pending') {
    askReason.value = { task, status }
    reason.value = ''
    nextTick(() => reasonInput.value && reasonInput.value.focus())
    return
  }
  move(task, status)
}

const askReason = ref(null)
const reason = ref('')
const reasonInput = ref(null)
function cancelReason() {
  askReason.value = null
}
function confirmReason() {
  if (!reason.value.trim()) return
  const { task, status } = askReason.value
  askReason.value = null
  move(task, status, reason.value.trim())
}

const update = createResource({ url: 'jms.api.update_task_status' })

async function move(task, status, pendingReason = null) {
  // move the card straight away, put it back if the server refuses
  const before = { status: task.status, pending_reason: task.pending_reason }
  task.status = status
  task.pending_reason = pendingReason
  saving.value = task.name
  try {
    // a failed call does not throw: it sets update.error
    await update.submit({ task: task.name, status, pending_reason: pendingReason })
    if (update.error) throw update.error
    emit('changed')
  } catch (e) {
    Object.assign(task, before)
    emit('error', e?.messages?.[0] || e?.message || 'Could not update the task')
  } finally {
    saving.value = null
  }
}
</script>
