<template>
  <Link :to="to" class="flex items-center">
    <span v-if="prefixIcon || $slots.prefix" class="mr-1">
      <slot name="prefix">
        <FontAwesomeIcon v-if="prefixIcon" :icon="prefixIcon" fixedWidth />
      </slot>
    </span>
    <slot />
  </Link>
</template>
<!-- from https://github.com/vuejs/eslint-plugin-vue/issues/1439 -->
