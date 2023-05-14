<script>
type Foo = number | string
</script>
<script setup lang="ts" generic="T extends Foo, U extends T">
const p = defineProps<{foo:T, bar: U}>()
const foo = p.foo
console.log(foo)
</script>
<template>
{{foo}}
</template>