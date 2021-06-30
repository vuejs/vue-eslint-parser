<script>
//comment1
export let count = 42//comment2
//comment3
</script>

<script setup>
//comment4
let foo;//comment5
//comment6
import MyComponent1 from './MyComponent1.vue'//comment7
//comment8
let count = 42//comment9
//comment10
import MyComponent2 from './MyComponent2.vue'//comment11
//comment12
let a = b + c//comment13
//comment14
</script>

<template>
    <MyComponent1>{{ count }}</MyComponent1>
    <MyComponent2/>
</template>

