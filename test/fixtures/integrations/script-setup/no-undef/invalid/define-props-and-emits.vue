<script setup>
{
  const props = defineProps({
    foo: String
  })

  const emit = defineEmits(['change', 'delete'])
}
</script>
