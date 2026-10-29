<template>
    <noscript>
        <img :src="url" alt="">
        {{ message }}
    </noscript>
    <iframe><p>{{ fallback }}</p></iframe>
</template>
