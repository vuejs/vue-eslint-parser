<script>
type Foo = number | string
</script>
<script setup lang="ts" generic="T extends Foo">
const p = defineProps<{foo:T}>()
const foo = p.foo
console.log(foo)
</script>
<template>
{{foo}}
</template>