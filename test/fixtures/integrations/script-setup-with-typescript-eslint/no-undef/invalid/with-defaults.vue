<script setup lang="ts">
interface Props {
  msg?: string
  labels?: string[]
}

{
  const props = withDefaults(defineProps<Props>(), {
    msg: 'hello',
    labels: () => ['one', 'two']
  })
}
</script>
