import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        include: [
            "test/{parser-options,crlf,define-document-visitor,define-custom-blocks-visitor}.test.ts",
        ],
    },
})
