<script setup lang="ts">
const [modelValue, modifiers] = defineModel<string, 'trim' | 'uppercase'>({
  set(value) {
    if (modifiers.trim) {
      return value.trim()
    }
    return value
  }
})
</script>

<template>
  <input v-model="modelValue">
</template>
