<template>
  <span class="indicator-pill whitespace-nowrap" :class="color">{{ status || '—' }}</span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ status: String })
const COLORS = {
  Created: 'gray', 'In Progress': 'purple', Processing: 'purple', Completed: 'green',
  Closed: 'darkgrey', Cancelled: 'red', Rejected: 'red',
}
const color = computed(() => COLORS[props.status] || 'gray')
</script>
