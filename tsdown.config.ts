import { defineConfig } from "tsdown"

const banner = `
/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * See LICENSE file in root directory for full license.
 */
`.trim()

export default defineConfig({
    entry: "./src/index.ts",
    exports: true,
    sourcemap: true,
    outputOptions: {
        banner,
    },
    dts: true,
    format: "cjs",
})
