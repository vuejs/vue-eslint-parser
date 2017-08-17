<template>
    <div v-for="x of xs" :key="x">
        {{x + y}}
        <div>{{x}}</div>
    </div>
    {{x}}
</template>
