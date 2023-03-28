<script setup lang="ts" generic="T extends Foo | Bar">
type Foo = number | string
type Bar = number[] | string[]
interface Props {
  msg?: T
}
defineProps<Props>(), {
  msg: 'hello',
}
</script>
