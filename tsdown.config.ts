import { defineConfig } from "tsdown"
import pkg from "./package.json"

export default defineConfig({
    entry: "./src/index.ts",
    target: "es2015",
    sourcemap: true,
    env: {
        PACKAGE_VERSION: pkg.version,
    },
    outputOptions: {
        banner: `/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * See LICENSE file in root directory for full license.
 */`,
    },
    dts: true,
    format: "cjs",
})
