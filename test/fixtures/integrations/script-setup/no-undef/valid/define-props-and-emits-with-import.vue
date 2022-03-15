<script setup>
import {defineProps, defineEmits} from 'vue'
const props = defineProps({
  foo: String
})

const emit = defineEmits(['change', 'delete'])
// setup code
</script>
