import { defineConfig } from "tsdown"

export default defineConfig({
    entry: "./src/index.ts",
    target: "es2015",
    sourcemap: true,
    outputOptions: {
        banner: `/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * See LICENSE file in root directory for full license.
 */`,
    },
    dts: true,
    format: "cjs",
})
