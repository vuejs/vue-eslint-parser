<template>
    <p>{{ greeting }} World!</p>
</template>

<script>
/*eslint linebreak-style: [error, windows] */

module.exports = {
    data() {
        return {greeting: "Hello"}
    },
}
</script>

<style scoped>
p {
    font-size: 2em;
    text-align: center;
}
</style>
