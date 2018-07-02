<template>
    <test-component>
        <div slot-scope="{a, b, ...c}">{{a + b + c.d}}</div>
    </test-component>
</template>
