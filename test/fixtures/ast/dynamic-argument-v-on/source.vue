<template>
    <button v-on:[key]="foo"></button>
    <button @[key]="foo"></button>
    <button @[key].enter="foo"></button>
</template>
