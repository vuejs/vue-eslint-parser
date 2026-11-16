<script setup>
    import { ref } from 'vue'
    import CreateModal from './CreateModal.vue'
    const createModal = ref({})
</script>

<template>
    <create-modal :data="createModal" />
</template>
