<script lang="ts">
  import Foo from '../component02/source.vue' // Foo: { name: string; props: { a: { type: NumberConstructor; default: number; }; }; }
  let a = 1; // a: number
  export default ({
    components: { // components: { Foo: { name: string; props: { a: { type: NumberConstructor; default: number; }; }; }; }
      Foo // Foo: { name: string; props: { a: { type: NumberConstructor; default: number; }; }; }, Foo: { name: string; props: { a: { type: NumberConstructor; default: number; }; }; }
    },
    data() { // data: () => { a: number; }
      return {
        a // a: number, a: number
      }
    },
  })
</script>