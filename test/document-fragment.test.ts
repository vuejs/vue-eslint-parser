//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

import type { VDocumentFragment } from "../src/ast"
import fs from "node:fs"
import path from "node:path"
import { describe, it, assert } from "vitest"
import * as parser from "../src"
import { replacer } from "./test-utils"

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

// eslint-disable-next-line no-undef
const ROOT = path.join(__dirname, "fixtures/document-fragment")
const TARGETS = fs.readdirSync(ROOT)
const PARSER_OPTIONS = {
    comment: true,
    ecmaVersion: "latest",
    loc: true,
    range: true,
    tokens: true,
    sourceType: "module",
}

//------------------------------------------------------------------------------
// Main
//------------------------------------------------------------------------------

describe("services.getDocumentFragment", () => {
    for (const name of TARGETS) {
        const sourceFileName = fs
            .readdirSync(path.join(ROOT, name))
            .find((f) => f.startsWith("source."))
        const sourcePath = path.join(ROOT, `${name}/${sourceFileName}`)
        const optionsPath = [
            path.join(ROOT, `${name}/parser-options.json`),
            path.join(ROOT, `${name}/parser-options.js`),
        ].find((fp) => fs.existsSync(fp))
        const source = fs.readFileSync(sourcePath, "utf8")
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const parserOptions = optionsPath ? require(optionsPath) : {}
        const options = {
            filePath: sourcePath,
            ...PARSER_OPTIONS,
            ...parserOptions,
        }
        const result = parser.parseForESLint(source, options)
        const actual = result.services!.getDocumentFragment()

        describe(`'test/fixtures/document-fragment/${name}/${sourceFileName}'`, () => {
            it("should be parsed to valid document fragment.", () => {
                const resultPath = path.join(
                    ROOT,
                    `${name}/document-fragment.json`,
                )
                const expected = fs.readFileSync(resultPath, "utf8")

                assert.strictEqual(
                    JSON.stringify(actual, replacer, 4),
                    expected,
                )
            })

            it("should have correct range.", () => {
                const resultPath = path.join(ROOT, `${name}/token-ranges.json`)
                const expectedText = fs.readFileSync(resultPath, "utf8")
                const tokens = getAllTokens(actual!).map((t) =>
                    source.slice(t.range[0], t.range[1]),
                )
                const actualText = JSON.stringify(tokens, null, 4)

                assert.strictEqual(actualText, expectedText)
            })
        })
    }
})

function getAllTokens(fgAst: VDocumentFragment) {
    const tokenArrays = [fgAst.tokens, fgAst.comments]

    return Array.prototype.concat.apply([], tokenArrays)
}
