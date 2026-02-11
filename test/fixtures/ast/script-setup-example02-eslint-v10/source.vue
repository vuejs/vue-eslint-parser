<script setup>
  // expects props options
  const props = defineProps({
    foo: String,
  })
  // expects emits options
  const emit = defineEmits(['update', 'delete'])
</script>
