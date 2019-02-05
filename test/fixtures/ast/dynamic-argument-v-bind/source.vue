<template>
    <button v-bind:[key]="foo"></button>
    <button :[key]="foo"></button>
    <button :[key].enter="foo"></button>
</template>
