<script setup lang="ts" generic="
  T // extends
    extends Foo,
    // Comments
  U /* extends */
    extends
    Record&lt;string, T>
">
type Foo = number | string
const p = defineProps<{foo:T, bar: U}>()
const foo = p.foo
console.log(foo)
</script>
<template>
{{foo}}
</template>