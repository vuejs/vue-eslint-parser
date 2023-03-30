
<script setup lang="ts">
    import type {Foo} from './types.ts'
    let val = 42
</script>

<template>
    <HelloWorld
      msg="You did it!"
      :foo="(val as Foo)"
    />
</template>
