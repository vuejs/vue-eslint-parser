<style>
</style>

<template>
  <div id="app">
    <img src="./assets/logo.png">
    <hello></hello>
  </div>
</template>

<script>
import { a, b } from './deps';
import Hello from './components/Hello';

export default {
  name: 'app',
  calc (x) {
    return x + a + b;
  },
  components: {
    Hello
  }
}
</script>
