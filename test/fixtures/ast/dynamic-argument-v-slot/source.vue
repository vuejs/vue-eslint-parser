<template>
    <button v-slot:[key]="foo"></button>
    <button #[key]="foo"></button>
</template>
