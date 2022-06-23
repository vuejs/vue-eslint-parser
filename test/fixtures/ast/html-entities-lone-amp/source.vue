<template>
    <MyComponent foo="&" />
    <MyComponent foo='&' />
    <MyComponent foo=& />
    <MyComponent foo=& bar />
    <MyComponent foo=&>{{a & b}}</MyComponent>
    &
</template>
