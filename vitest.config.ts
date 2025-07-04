import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        include: ["test/{parser-options,crlf,define-document-visitor}.test.ts"],
    },
})
