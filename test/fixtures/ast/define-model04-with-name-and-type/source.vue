<script setup>
const count = defineModel('count', { type: Number, default: 0 })
</script>

<template>
  {{ count }}
  <button @click="() => count++">Click Me</button>
</template>
