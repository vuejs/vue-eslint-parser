<template>
    <test-component>
        <template v-slot:header="{ foo }">
            {{foo}}
        </template>
    </test-component>
</template>
