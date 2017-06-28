<template>
    <div v-for="a in list"></div>
    <div v-for="(a, b, c) in list"></div>
    <div v-for="a of list"></div>
    <div v-for="(a, b, c) of list"></div>
</template>
