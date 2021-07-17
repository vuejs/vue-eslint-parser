<style lang="scss">
  .text{
    color: v-bind(color);
  }
  .text{
    color: v-bind("colors[42]");
  }
  .text{
    color: v-bind('getColor()');
  }
  .str-and-comments{
    content: "v-bind('getColor()')";
    content: "v-bind('getColor()')\"v-bind(color)";
    // color: v-bind(color);
    /* color: v-bind(color); */
    color: /**/v-bind(color);
  }
</style>
