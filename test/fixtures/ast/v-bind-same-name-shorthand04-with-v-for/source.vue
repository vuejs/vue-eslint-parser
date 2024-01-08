<script>
export default {
  data () {
    return {
      srcList: [
        "https://github.com/vuejs.png",
        "https://github.com/vitejs.png"
      ]
    }
  }
}
</script>

<template>
  <div>
    <img v-for="src in srcList" :src>
  </div>
</template>
