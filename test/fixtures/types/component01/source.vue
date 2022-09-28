<script lang="ts">
  import Foo from '../component02/source.vue'
  let a = 1;
  export default ({
    components: {
      Foo
    },
    data() {
      return {
        a
      }
    },
  })
</script>