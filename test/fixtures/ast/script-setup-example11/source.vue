<script setup lang="ts">
interface Props {
  msg?: string
}

const props = withDefaults(defineProps<Props>(), {
  msg: 'hello'
})
</script>
