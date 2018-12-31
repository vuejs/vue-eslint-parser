<template>
    {{ value | foo() || 1 }}
    {{ value | foo().a }}
    {{ value | foo()() }}
</template>
