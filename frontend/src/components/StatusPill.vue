<template>
  <span class="indicator-pill whitespace-nowrap" :class="color">{{ status || '—' }}</span>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ status: String })
const COLORS = { Open: 'blue', 'In Progress': 'purple', Pending: 'orange', Completed: 'green', Cancelled: 'red' }
const color = computed(() => COLORS[props.status] || 'gray')
</script>
