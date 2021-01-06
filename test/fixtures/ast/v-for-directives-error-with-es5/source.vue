<template>
    <div v-for="abc"></div>
    <div v-for="in abc"></div>
    <div v-for="/**/ in abc"></div>
    <!-- destructuring -->
    <div v-for="{key,name} in list"></div>
    <div v-for="{key:key,name:name} in list"></div>
    <div v-for="([a,,b], c) in list"></div>
    <div v-for="[a,b] of list"></div>
    <div v-for="{[z]:key=x,name} in list"></div>
</template>
