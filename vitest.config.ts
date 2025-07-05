import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        reporters: "dot",
        include: ["test/*.test.ts"],
        teardownTimeout: 60000,
    },
})
