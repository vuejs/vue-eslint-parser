"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const assert = require("assert")
const fs = require("fs")
const path = require("path")
const parser = require("../src")

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const ROOT = path.join(__dirname, "fixtures/document-fragment")
const TARGETS = fs.readdirSync(ROOT)
const PARSER_OPTIONS = {
    comment: true,
    ecmaVersion: 6,
    loc: true,
    range: true,
    tokens: true,
    sourceType: "module",
}

/**
 * Remove `parent` proeprties from the given AST.
 * @param {string} key The key.
 * @param {any} value The value of the key.
 * @returns {any} The value of the key to output.
 */
function replacer(key, value) {
    if (key === "parent") {
        return undefined
    }
    if (key === "errors" && Array.isArray(value)) {
        return value.map((e) => ({
            message: e.message,
            index: e.index,
            lineNumber: e.lineNumber,
            column: e.column,
        }))
    }
    return value
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
        const optionsPath = path.join(ROOT, `${name}/parser-options.json`)
        const source = fs.readFileSync(sourcePath, "utf8")
        const parserOptions = fs.existsSync(optionsPath)
            ? JSON.parse(fs.readFileSync(optionsPath, "utf8"))
            : {}
        const options = Object.assign(
            { filePath: sourcePath },
            PARSER_OPTIONS,
            parserOptions
        )
        const result = parser.parseForESLint(source, options)
        const actual = result.services.getDocumentFragment()

        describe(`'test/fixtures/document-fragment/${name}/${sourceFileName}'`, () => {
            it("should be parsed to valid document fragment.", () => {
                const resultPath = path.join(
                    ROOT,
                    `${name}/document-fragment.json`
                )
                const expected = fs.readFileSync(resultPath, "utf8")

                assert.strictEqual(
                    JSON.stringify(actual, replacer, 4),
                    expected
                )
            })

            it("should have correct range.", () => {
                const resultPath = path.join(ROOT, `${name}/token-ranges.json`)
                const expectedText = fs.readFileSync(resultPath, "utf8")
                const tokens = getAllTokens(actual).map((t) =>
                    source.slice(t.range[0], t.range[1])
                )
                const actualText = JSON.stringify(tokens, null, 4)

                assert.strictEqual(actualText, expectedText)
            })
        })
    }
})

function getAllTokens(fgAst) {
    const tokenArrays = [fgAst.tokens, fgAst.comments]

    return Array.prototype.concat.apply([], tokenArrays)
}
