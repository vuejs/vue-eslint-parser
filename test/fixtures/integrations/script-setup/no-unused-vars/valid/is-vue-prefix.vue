<script setup>
    import MyRow from './MyRow.vue'
    import * as Form from './form-components'
</script>

<template>
    <table>
        <tr is="vue:my-row" />
    </table>
    <div is="vue:Form.Input" />
    <div is="vue:" />
</template>
