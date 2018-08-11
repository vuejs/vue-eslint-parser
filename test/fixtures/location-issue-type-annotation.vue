<template>
  <div>{{ msg }}</div>
</template>

<script lang="ts">
import Vue from 'vue';

enum Direction {
  Up,
  Down,
}

const baz : string = 'hi'; // <- wrong range of type annotation

export default Vue.extend({
  name: 'HelloWorld',
  props: {
    msg: String,
  },
});
</script>

<style>
</style>
