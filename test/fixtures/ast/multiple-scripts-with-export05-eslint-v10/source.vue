<script>
export let count = 42
export {count as "foo-bar"}
</script>
<script setup>
let count = 42
export {count as "foo-bar"}
export {count as count}
</script>
