<script setup lang="ts" generic="
  AType
    extends string
">
interface Props {
    a: AType;
    b: string;
}
const props = defineProps<Props>()
const x = props.a
const y = props.b
</script>
