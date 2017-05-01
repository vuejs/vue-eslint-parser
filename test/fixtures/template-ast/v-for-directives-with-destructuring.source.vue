<template>
    <div v-for="{key,name} in list"></div>
    <div v-for="([a,,b], c) in list"></div>
    <div v-for="[a,b] of list"></div>
    <div v-for="{[z]:key=x,name} in list"></div>
</template>
