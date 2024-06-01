<script setup lang="ts" generic="
  T extends () => string,
  U  extends () => string = () => 'abc'
">
const p = defineProps<{t: T, u: U}>()
</script>

<template>
{{p.t()}}
{{p.u()}}
</template>