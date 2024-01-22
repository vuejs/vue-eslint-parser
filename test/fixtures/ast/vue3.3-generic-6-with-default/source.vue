<script setup lang="ts" generic="
  T // Comments
    extends /* = */ Foo = number,
    // Comments
  U /* extends */
    extends
    Record&lt;
      /* = */
      string, // =
      T
    >
     = Record<string, number&gt;
">
type Foo = number | string
const p = defineProps<{foo:T, bar: U}>()
const foo = p.foo
console.log(foo)
</script>
<template>
{{foo}}
</template>