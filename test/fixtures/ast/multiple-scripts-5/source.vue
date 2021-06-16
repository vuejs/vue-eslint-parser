<script>
export let count = 42
</script>

<template><Foo>{{ count }}</Foo></template>

<script setup>
import Foo from './Foo.vue'
let count = 42
</script>
