<template>
    <a @click.prevent="setUploadType('DIR'); showModal('uploadFile')">
        <i class="fa fa-fw fa-lg fa-cloud-upload" aria-hidden="true"></i>
    </a>
</template>
