/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const assert = require("assert")
const fs = require("fs")
const path = require("path")
const parser = require("../src")
const eslint = require("eslint")
const semver = require("semver")
const { scopeToJSON, analyze, replacer, getAllTokens } = require("./test-utils")

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------
const Linter = eslint.Linter
const ROOT = path.join(__dirname, "fixtures/ast")
const TARGETS = fs.readdirSync(ROOT)
const PARSER_OPTIONS = {
    comment: true,
    ecmaVersion: "latest",
    sourceType: "module",
    loc: true,
    range: true,
    tokens: true,
    eslintScopeManager: true,
}

/**
 * Create simple tree.
 * @param {string} source The source code.
 * @param {object} parserOptions The parser options.
 * @returns {object} Simple tree.
 */
function getTree(source, parserOptions) {
    const linter = new Linter({ configType: "flat" })
    const stack = []
    const root = { children: [] }
    let current = root

    const maketree = {
        create: (ruleContext) =>
            ruleContext.sourceCode.parserServices.defineTemplateBodyVisitor({
                "*"(node) {
                    stack.push(current)
                    current.children.push(
                        (current = {
                            type: node.type,
                            text: source.slice(node.range[0], node.range[1]),
                            children: [],
                        }),
                    )
                },
                "*:exit"() {
                    current = stack.pop()
                },
            }),
    }
    const result = linter.verify(
        source,
        {
            files: ["**"],
            plugins: {
                test: {
                    rules: {
                        maketree,
                    },
                },
            },
            languageOptions: {
                parser: parser,
                ecmaVersion: parserOptions.ecmaVersion ?? "latest",
                sourceType: parserOptions.sourceType ?? "module",
                parserOptions: parserOptions,
            },
            rules: { "test/maketree": "error" },
        },
        undefined,
        true,
    )
    assert.deepStrictEqual(result, [])

    return root.children
}

/**
 * Convert a given node to string.
 * @param {Node} node The node to make string expression.
 * @param {string} source The source code.
 * @returns {string} The string expression of the node.
 */
function nodeToString(node, source) {
    return node ? `${node.type}[${source.slice(...node.range)}]` : "undefined"
}

/**
 * Validate the parent property of every node.
 * @param {string} source The source code.
 * @param {object} parserOptions The parser options.
 * @returns {void}
 */
function validateParent(source, parserOptions) {
    const linter = new Linter({ configType: "flat" })
    const stack = []

    const validateparent = {
        create: (ruleContext) =>
            ruleContext.sourceCode.parserServices.defineTemplateBodyVisitor({
                "*"(node) {
                    if (stack.length >= 1) {
                        const parent = stack.at(-1)
                        assert(
                            node.parent === parent,
                            `The parent of ${nodeToString(
                                node,
                                source,
                            )} should be ${nodeToString(
                                parent,
                                source,
                            )}, but got ${nodeToString(node.parent, source)}`,
                        )
                    }
                    stack.push(node)
                },
                "*:exit"() {
                    stack.pop()
                },
            }),
    }
    const result = linter.verify(
        source,
        {
            files: ["**"],
            plugins: {
                test: {
                    rules: {
                        validateparent,
                    },
                },
            },
            languageOptions: {
                parser,
                ecmaVersion: parserOptions.ecmaVersion ?? "latest",
                sourceType: parserOptions.sourceType ?? "module",
                parserOptions: parserOptions,
            },
            rules: { "test/validateparent": "error" },
        },
        undefined,
        true,
    )
    assert.deepStrictEqual(result, [])
}

//------------------------------------------------------------------------------
// Main
//------------------------------------------------------------------------------

describe("Template AST", () => {
    for (const name of TARGETS) {
        const sourcePath = path.join(ROOT, `${name}/source.vue`)
        const optionsPath = [
            path.join(ROOT, `${name}/parser-options.json`),
            path.join(ROOT, `${name}/parser-options.js`),
        ].find((fp) => fs.existsSync(fp))
        const requirementsPath = path.join(ROOT, `${name}/requirements.json`)
        const servicesPath = path.join(ROOT, `${name}/services.json`)
        const source = fs.readFileSync(sourcePath, "utf8")
        const parserOptions = optionsPath ? require(optionsPath) : {}
        const requirements = fs.existsSync(requirementsPath)
            ? JSON.parse(fs.readFileSync(requirementsPath, "utf8"))
            : {}
        const services = fs.existsSync(servicesPath)
            ? JSON.parse(fs.readFileSync(servicesPath, "utf8"))
            : null
        if (parserOptions.templateTokenizer) {
            parserOptions.templateTokenizer = Object.fromEntries(
                Object.entries(parserOptions.templateTokenizer).map(
                    ([key, value]) => [
                        key,
                        path.resolve(__dirname, "../", value),
                    ],
                ),
            )
        }
        const options = {
            filePath: sourcePath,
            ...PARSER_OPTIONS,
            ...parserOptions,
        }

        if (
            Object.entries(requirements).some(([pkgName, pkgVersion]) => {
                const version =
                    pkgName === "node"
                        ? process.version
                        : require(`${pkgName}/package.json`).version
                return !semver.satisfies(version, pkgVersion)
            })
        ) {
            continue
        }

        const actual = parser.parseForESLint(source, options)

        describe(`'test/fixtures/ast/${name}/source.vue'`, () => {
            it("should be parsed to valid AST.", () => {
                const resultPath = path.join(ROOT, `${name}/ast.json`)
                const expected = fs.readFileSync(resultPath, "utf8")

                assert.strictEqual(
                    JSON.stringify(actual.ast, replacer, 4),
                    expected,
                )
            })

            it("should have correct range.", () => {
                const resultPath = path.join(ROOT, `${name}/token-ranges.json`)
                const expectedText = fs.readFileSync(resultPath, "utf8")
                const tokens = getAllTokens(actual.ast).map((t) =>
                    source.slice(t.range[0], t.range[1]),
                )
                const actualText = JSON.stringify(tokens, null, 4)

                assert.strictEqual(actualText, expectedText)
            })

            it("should have correct range on windows(CRLF).", () => {
                const sourceForWin = source.replace(/\r?\n/gu, "\r\n")
                const actualForWin = parser.parseForESLint(
                    sourceForWin,
                    options,
                )

                const resultPath = path.join(ROOT, `${name}/token-ranges.json`)
                const expectedText = fs.readFileSync(resultPath, "utf8")
                const tokens = getAllTokens(actualForWin.ast).map((t) =>
                    sourceForWin
                        .slice(t.range[0], t.range[1])
                        .replace(/\r?\n/gu, "\n"),
                )
                const actualText = JSON.stringify(tokens, null, 4)

                assert.strictEqual(actualText, expectedText)
            })

            it("should have correct location.", () => {
                const lines = source.match(/[^\r\n]*(?:\r?\n|$)/gu) ?? []
                lines.push(String.fromCodePoint(0))
                for (const token of getAllTokens(actual.ast)) {
                    const line0 = token.loc.start.line - 1
                    const line1 = token.loc.end.line - 1
                    const column0 = token.loc.start.column
                    const column1 = token.loc.end.column
                    const expected = source.slice(
                        token.range[0],
                        token.range[1],
                    )

                    let text = ""
                    if (line0 === line1) {
                        text = lines[line0].slice(column0, column1)
                    } else {
                        text = lines[line0].slice(column0)
                        for (let i = line0 + 1; i < line1; ++i) {
                            text += lines[i]
                        }
                        text += lines[line1].slice(0, column1)
                    }

                    assert.strictEqual(
                        text,
                        expected,
                        `${JSON.stringify(
                            token,
                            null,
                            4,
                        )} expected ${JSON.stringify(
                            expected,
                        )}, but got ${JSON.stringify(text)}`,
                    )
                }
            })

            it("should traverse AST in the correct order.", () => {
                const resultPath = path.join(ROOT, `${name}/tree.json`)
                const expectedText = fs.readFileSync(resultPath, "utf8")
                const tokens = getTree(source, parserOptions)
                const actualText = JSON.stringify(tokens, null, 4)

                assert.strictEqual(actualText, expectedText)
            })

            it("should scope in the correct.", () => {
                const resultPath = path.join(ROOT, `${name}/scope.json`)
                if (!fs.existsSync(resultPath)) {
                    return
                }
                const expectedText = fs.readFileSync(resultPath, "utf8")
                const actualText = scopeToJSON(
                    actual.scopeManager || analyze(actual.ast, options),
                )

                assert.strictEqual(actualText, expectedText)
            })

            it("should have correct parent properties.", () => {
                validateParent(source, parserOptions)
            })

            if (services) {
                it("should have correct services.", () => {
                    assert.deepStrictEqual(
                        Object.keys(actual.services).sort(),
                        services,
                    )
                })
            }
        })
    }
})
