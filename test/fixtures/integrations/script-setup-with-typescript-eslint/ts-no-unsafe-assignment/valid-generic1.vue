<script setup lang="ts" generic="AType">
interface Props {
    a: AType;
    b: string;
}
const props = defineProps<Props>()
const x = props.a
const y = props.b
</script>
