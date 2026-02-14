<script lang="ts" setup>
import { ref } from 'vue'

let shouldShow = ref(false)
shouldShow = ref(true)
console.log(shouldShow)
</script>

<template>
    <div v-if="shouldShowXXXX">
        Hello World
    </div>
</template>
