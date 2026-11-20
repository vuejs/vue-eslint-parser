<script vapor>
    const props = defineProps({ msg: String })
    const emit = defineEmits(['change'])
</script>

<template>
    <button @click="emit('change')">{{ props.msg }}</button>
</template>
