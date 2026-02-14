<script lang="ts" setup>
import { ref } from 'vue'

const shouldShow = ref(false)
</script>

<template>
    <div v-if="shouldShow">
        Hello World
    </div>
</template>
