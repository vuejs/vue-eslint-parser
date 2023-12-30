<script setup lang="ts">
const modelValue = defineModel<string>({ required: true })
</script>

<template>
  <input v-model="modelValue">
</template>
