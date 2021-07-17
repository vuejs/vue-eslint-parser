<script setup>
  /* eslint script-setup-uses-vars: 1 */
  const color = 'red'
</script>

<style lang="scss">
  .v-bind .color {
    color: 'v-bind(color)';
    background-color: 'v-bind(color)';
  }
  /* v-bind(color) */
  // v-bind(color)
</style>
