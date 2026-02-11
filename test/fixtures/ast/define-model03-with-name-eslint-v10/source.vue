<script setup>
let count = defineModel('count')
</script>

<template>
  {{ count }}
  <button @click="() => count++">Click Me</button>
</template>
