<script setup lang="ts">
const modelValue = defineModel<string>()
</script>

<template>
  <input v-model="modelValue">
</template>
