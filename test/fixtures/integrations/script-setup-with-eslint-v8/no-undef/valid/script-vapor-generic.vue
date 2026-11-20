<script vapor lang="ts" generic="T extends string">
const props = defineProps<{ items: T[] }>()
</script>

<template>
    <div v-for="item in props.items" :key="item">{{ item }}</div>
</template>
