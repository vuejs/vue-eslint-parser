import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        reporters: "dot",
        include: ["test/**/*.test.ts"],
        testTimeout: 60000,
        coverage: {
            include: ["src/**/*.ts"],
            exclude: ["src/external/**/*.ts"],
            reporter: ["html", "lcov", "text-summary"],
        },
    },
})
