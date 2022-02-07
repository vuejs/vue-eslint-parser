<script setup>
    const color = 'red'
    const font = { size: '2em' }
</script>

<style>
    * {
        color: v-bind(color);
        font-size: v-bind('font.size');
    }
</style>
