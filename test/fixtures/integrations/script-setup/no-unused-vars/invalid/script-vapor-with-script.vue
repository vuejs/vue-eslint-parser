<script>
    export default { name: 'Counter' }
</script>

<script vapor>
    import { ref } from 'vue'
    const count = ref(0)
    const unused = ref(0)
</script>

<template>
    <button @click="count++">{{ count }}</button>
</template>
