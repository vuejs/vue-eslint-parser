<script>
var a = foo
</script>
<template>
  <div
    @click="a=b"
  ></div>
  <div
    :data-foo="c&amp;&amp;d"
  ></div>
  <div
    :data-click="a=b"
  ></div>
  <div
    @foo="c&amp;&amp;d"
  ></div>
</template>
