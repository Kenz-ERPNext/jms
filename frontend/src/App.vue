<template>
  <div class="pb-8">
    <!-- keep the dashboard alive so its filter, search and loaded jobs are still
         there when coming back from a job -->
    <router-view v-slot="{ Component }">
      <keep-alive include="Dashboard">
        <component :is="Component" />
      </keep-alive>
    </router-view>
  </div>
</template>
