<script setup lang="ts">
import MyComponent from "./components/MyComponent.vue";
interface Foo {
  foo?: string;
}
type Bar = string;
</script>

<template>
  <MyComponent
    :foo="{} as Foo"
    :bar="'s' as Bar"
  />
</template>