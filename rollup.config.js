/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import resolve from "rollup-plugin-node-resolve"
import sourcemaps from "rollup-plugin-sourcemaps"

const pkg = require("./package.json")
const external = [
    "assert",
    "events",
    "fs", //TODO: remove fs
    "path",
    "eslint/lib/util/node-event-generator",
    "eslint/lib/token-store",
    ...Object.keys(pkg.dependencies),
]

export default {
    entry: ".temp/index.js",
    external,
    dest: "index.js",
    format: "cjs",
    sourceMap: true,
    sourceMapFile: "index.js.map",
    plugins: [
        sourcemaps(),
        resolve({external}),
    ],
    banner: `/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */`,
}
