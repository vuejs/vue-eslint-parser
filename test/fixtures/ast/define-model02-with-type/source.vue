<script setup>
const model = defineModel({ type: String })
</script>

<template>
  <input v-model="model">
</template>
