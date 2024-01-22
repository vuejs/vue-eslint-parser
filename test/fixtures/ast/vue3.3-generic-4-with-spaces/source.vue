<script setup lang="ts" generic="
  T
    extends Foo,
    // Comments
  U extends
    T
">
type Foo = number | string
const p = defineProps<{foo:T, bar: U}>()
const foo = p.foo
console.log(foo)
</script>
<template>
{{foo}}
</template>