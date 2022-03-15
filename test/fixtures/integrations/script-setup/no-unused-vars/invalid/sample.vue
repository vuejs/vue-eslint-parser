<script setup>
    // imported components are also directly usable in template
    import Foo from './Foo.vue'
    import Bar from './Bar.vue'
    import { ref } from 'vue'

    // write Composition API code just like in a normal setup()
    // but no need to manually return everything
    const count = ref(0)
    const inc = () => {
    count.value++
    }
    const foo = ref(42)
    console.log(foo.value)
    const bar = ref(42)
    bar.value++
    const baz = ref(42)
</script>

<template>
    <Foo :count="count" @click="inc" />
</template>
