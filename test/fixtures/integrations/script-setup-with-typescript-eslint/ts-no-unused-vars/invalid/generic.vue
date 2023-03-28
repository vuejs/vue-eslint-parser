<script setup lang="ts" generic="T extends FooFoo | Bar">
type FooFoo = number | string
type Bar = number[] | string[]
type Baz = boolean | 'foo'
interface Props {
  msg?: T
}
defineProps<Props>(), {
  msg: 'hello',
}
</script>
