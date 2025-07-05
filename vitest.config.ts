import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        reporters: "dot",
        include: ["test/**/*.test.ts"],
        testTimeout: 60000,
        coverage: {
            include: ["src"],
        },
    },
})
