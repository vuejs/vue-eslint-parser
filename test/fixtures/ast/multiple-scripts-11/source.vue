<!-- https://github.com/vuejs/eslint-plugin-vue/issues/1690 -->
<template>
  <div class="f-c" style="height: 100%;">
  </div>
</template>
<script setup>
import { ref, computed } from 'vue' // each time uncomment error will print. anything from 'vue'
import { useStore } from 'vuex' // others like this is ok
</script>

<script>
export default {
  name: 'App',
  components: {
  },
}
</script>