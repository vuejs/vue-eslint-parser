<script>
export let count = 42
</script>

<script setup>
import MyComponent1 from './MyComponent1.vue'
let count = 42
import MyComponent2 from './MyComponent2.vue'
let a = b + c
</script>

<template>
    <MyComponent1>{{ count }}</MyComponent1>
    <MyComponent2/>
</template>

