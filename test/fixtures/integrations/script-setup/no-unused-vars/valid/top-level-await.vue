<script setup>
    const post = await fetch(`/api/post/1`).then((r) => r.json())
</script>

<template>
    {{post}}
</template>
