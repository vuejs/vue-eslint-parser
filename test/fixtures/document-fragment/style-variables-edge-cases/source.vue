<style>
  .text{
    color: v-bind(  color /* comment1 */ );
    font-size: v-bind( /* comment2 */ 'font.size'  /* comment3 */ ); /* vue 3.1 may not work well. */
    border-color: v-bind(  "border('color')// comment4
    ");
    background-color: v-bind(  "background. /*comment5*/ color /*comment6*/ "
    );
  }
</style>
