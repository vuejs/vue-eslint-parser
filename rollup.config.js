/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import resolve from "rollup-plugin-node-resolve"
import sourcemaps from "rollup-plugin-sourcemaps"

const pkg = require("./package.json")
const deps = new Set(
    ["assert", "events", "path"].concat(Object.keys(pkg.dependencies))
)

export default {
    input: ".temp/index.js",
    output: {
        file: "index.js",
        format: "cjs",
        sourcemap: true,
        sourcemapFile: "index.js.map",
    },
    plugins: [sourcemaps(), resolve()],
    external: id => deps.has(id) || id.startsWith("lodash"),
    banner: `/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */`,
}
