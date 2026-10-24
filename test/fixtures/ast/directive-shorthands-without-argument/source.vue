<template>
    <div :="attrs"></div>
    <div .="props"></div>
    <div @="listeners"></div>
    <test-component #="{ item }">{{ item }}</test-component>
    <div :></div>
</template>
