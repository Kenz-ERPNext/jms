// Colours and icons for task statuses, shared by the pages.
export const STATUSES = {
  all: { label: 'All tasks', icon: 'layers', tone: 'gray' },
  open: { label: 'Open', icon: 'circle', tone: 'blue', value: 'Open' },
  in_progress: { label: 'In Progress', icon: 'loader', tone: 'violet', value: 'In Progress' },
  pending: { label: 'Pending', icon: 'pause-circle', tone: 'orange', value: 'Pending' },
  completed: { label: 'Completed', icon: 'check-circle', tone: 'green', value: 'Completed' },
  cancelled: { label: 'Cancelled', icon: 'x-circle', tone: 'red', value: 'Cancelled' },
}

// Full class names (not built from parts) so Tailwind keeps them in the build.
export const TONES = {
  gray: { soft: 'bg-gray-100 text-gray-700', active: 'border-gray-800 bg-gray-50', icon: 'bg-gray-100 text-gray-600', solid: 'bg-gray-800 text-white', bar: 'bg-gray-400', text: 'text-gray-800' },
  blue: { soft: 'bg-blue-50 text-blue-700', active: 'border-blue-500 bg-blue-50/60', icon: 'bg-blue-100 text-blue-600', solid: 'bg-blue-500 text-white', bar: 'bg-blue-500', text: 'text-blue-700' },
  violet: { soft: 'bg-violet-50 text-violet-700', active: 'border-violet-500 bg-violet-50/60', icon: 'bg-violet-100 text-violet-600', solid: 'bg-violet-500 text-white', bar: 'bg-violet-500', text: 'text-violet-700' },
  orange: { soft: 'bg-orange-50 text-orange-700', active: 'border-orange-500 bg-orange-50/60', icon: 'bg-orange-100 text-orange-600', solid: 'bg-orange-500 text-white', bar: 'bg-orange-500', text: 'text-orange-700' },
  green: { soft: 'bg-green-50 text-green-700', active: 'border-green-500 bg-green-50/60', icon: 'bg-green-100 text-green-600', solid: 'bg-green-500 text-white', bar: 'bg-green-500', text: 'text-green-700' },
  red: { soft: 'bg-red-50 text-red-700', active: 'border-red-500 bg-red-50/60', icon: 'bg-red-100 text-red-600', solid: 'bg-red-500 text-white', bar: 'bg-red-500', text: 'text-red-700' },
}

// Colour of a Job's own status (not a task status).
const JOB_TONES = {
  Created: 'gray', 'In Progress': 'violet', Processing: 'violet', Completed: 'green',
  Closed: 'gray', Cancelled: 'red', Rejected: 'red',
}

export function jobTone(status) {
  return TONES[JOB_TONES[status] || 'gray']
}

export function toneOf(status) {
  const entry = Object.values(STATUSES).find((s) => s.value === status)
  return TONES[entry ? entry.tone : 'gray']
}

export function formatDate(value) {
  if (!value) return ''
  const d = new Date(String(value).replace(' ', 'T'))
  if (isNaN(d)) return value
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

export function formatDateTime(value) {
  if (!value) return ''
  const fd = window.frappe && window.frappe.datetime
  if (fd && fd.str_to_user) return fd.str_to_user(value)
  const d = new Date(String(value).replace(' ', 'T'))
  if (isNaN(d)) return value
  return d.toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function timeAgo(value) {
  if (!value) return ''
  // Server times are in the system time zone; the desk knows how to convert them.
  const fd = window.frappe && window.frappe.datetime
  if (fd && fd.comment_when) return fd.comment_when(value, true)
  const d = new Date(String(value).replace(' ', 'T'))
  if (isNaN(d)) return ''
  const s = Math.round((Date.now() - d.getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hour${h > 1 ? 's' : ''} ago`
  const days = Math.round(h / 24)
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`
  return formatDate(value)
}
