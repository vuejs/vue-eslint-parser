<script setup>
const [modelValue, modelModifiers] = defineModel({
  set(value) {
    if (modelModifiers.trim) {
      return value.trim()
    }
    return value
  }
})
</script>

<template>
  <input v-model="modelValue">
</template>
