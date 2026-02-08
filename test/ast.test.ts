/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

import type { Rule } from "eslint"
import type { Node } from "../src/ast"
import type { ParserOptions } from "../src/common/parser-options"
import fs from "node:fs"
import path from "node:path"
import { describe, it, assert, expect } from "vitest"
import { Linter } from "eslint"
import semver from "semver"
import * as parser from "../src"
import { scopeToJSON, analyze, replacer, getAllTokens } from "./test-utils"

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------
// eslint-disable-next-line no-undef
const ROOT = path.join(__dirname, "fixtures/ast")
const TARGETS = fs.readdirSync(ROOT)
const PARSER_OPTIONS: ParserOptions = {
    comment: true,
    ecmaVersion: "latest",
    sourceType: "module",
    loc: true,
    range: true,
    tokens: true,
    eslintScopeManager: true,
}

type TreeNode = {
    type?: string
    text?: string
    children: TreeNode[]
}

/**
 * Create simple tree.
 * @param source The source code.
 * @param parserOptions The parser options.
 * @returns Simple tree.
 */
function getTree(source: string, parserOptions: any) {
    const linter = new Linter({ configType: "flat" })
    const stack: TreeNode[] = []
    const root: TreeNode = { children: [] }
    let current: TreeNode = root

    const maketree: Rule.RuleModule = {
        create: (ruleContext) =>
            ruleContext.sourceCode.parserServices.defineTemplateBodyVisitor({
                "*"(node: Node) {
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
                    current = stack.pop()!
                },
            }),
    }
    const result = linter.verify(source, {
        files: ["**"],
        plugins: {
            test: {
                rules: {
                    maketree,
                },
            },
        },
        languageOptions: {
            parser,
            ecmaVersion: parserOptions.ecmaVersion ?? "latest",
            sourceType: parserOptions.sourceType ?? "module",
            parserOptions,
        },
        rules: { "test/maketree": "error" },
    })
    assert.deepStrictEqual(result, [])

    return root.children
}

/**
 * Convert a given node to string.
 * @param node The node to make string expression.
 * @param source The source code.
 * @returns The string expression of the node.
 */
function nodeToString(node: Node, source: string): string {
    return node ? `${node.type}[${source.slice(...node.range)}]` : "undefined"
}

/**
 * Validate the parent property of every node.
 * @param source The source code.
 * @param parserOptions The parser options.
 */
function validateParent(source: string, parserOptions: any) {
    const linter = new Linter({ configType: "flat" })
    const stack: Node[] = []

    const validateparent: Rule.RuleModule = {
        create: (ruleContext) =>
            ruleContext.sourceCode.parserServices.defineTemplateBodyVisitor({
                "*"(node: Node) {
                    if (stack.length >= 1) {
                        const parent = stack.at(-1)!
                        assert(
                            node.parent === parent,
                            `The parent of ${nodeToString(
                                node,
                                source,
                            )} should be ${nodeToString(
                                parent,
                                source,
                            )}, but got ${nodeToString(node.parent!, source)}`,
                        )
                    }
                    stack.push(node)
                },
                "*:exit"() {
                    stack.pop()
                },
            }),
    }
    const result = linter.verify(source, {
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
            parserOptions,
        },
        rules: { "test/validateparent": "error" },
    })
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
        const source = fs.readFileSync(sourcePath, "utf8")

        const parserOptions: ParserOptions = optionsPath
            ? require(optionsPath) // eslint-disable-line @typescript-eslint/no-require-imports
            : {}
        const requirements: Record<string, string> = fs.existsSync(
            requirementsPath,
        )
            ? JSON.parse(fs.readFileSync(requirementsPath, "utf8"))
            : {}

        if (parserOptions.templateTokenizer) {
            parserOptions.templateTokenizer = Object.fromEntries(
                Object.entries(parserOptions.templateTokenizer).map(
                    ([key, value]) => [
                        key,
                        // eslint-disable-next-line no-undef
                        path.resolve(__dirname, "../", value as string),
                    ],
                ),
            )
        }
        const options: ParserOptions = {
            filePath: sourcePath,
            ...PARSER_OPTIONS,
            ...parserOptions,
        }

        if (
            Object.entries(requirements).some(([pkgName, pkgVersion]) => {
                const version =
                    pkgName === "node"
                        ? process.version
                        : require(`${pkgName}/package.json`).version // eslint-disable-line @typescript-eslint/no-require-imports
                return !semver.satisfies(version, pkgVersion)
            })
        ) {
            continue
        }

        const actual = parser.parseForESLint(source, options)

        describe(`'test/fixtures/ast/${name}/source.vue'`, () => {
            it("should be parsed to valid AST.", async () => {
                const resultPath = path.join(ROOT, `${name}/ast.json`)

                await expect(
                    JSON.stringify(actual.ast, replacer, 4),
                ).toMatchFileSnapshot(resultPath)
            })

            it("should have correct range.", async () => {
                const resultPath = path.join(ROOT, `${name}/token-ranges.json`)
                const tokenRanges = getAllTokens(actual.ast).map((t) =>
                    source.slice(t.range[0], t.range[1]),
                )

                await expect(
                    JSON.stringify(tokenRanges, replacer, 4),
                ).toMatchFileSnapshot(resultPath)
            })

            it("should have correct range on windows(CRLF).", async () => {
                const sourceForWin = source.replace(/\r?\n/gu, "\r\n")
                const actualForWin = parser.parseForESLint(
                    sourceForWin,
                    options,
                )

                const resultPath = path.join(ROOT, `${name}/token-ranges.json`)
                const tokens = getAllTokens(actualForWin.ast).map((t) =>
                    sourceForWin
                        .slice(t.range[0], t.range[1])
                        .replace(/\r?\n/gu, "\n"),
                )
                const actualText = JSON.stringify(tokens, replacer, 4)

                await expect(actualText).toMatchFileSnapshot(resultPath)
            })

            it("should have correct location.", () => {
                const lines: string[] =
                    source.match(/[^\r\n]*(?:\r?\n|$)/gu) ?? []
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
                            replacer,
                            4,
                        )} expected ${JSON.stringify(
                            expected,
                        )}, but got ${JSON.stringify(text)}`,
                    )
                }
            })

            it("should traverse AST in the correct order.", async () => {
                const resultPath = path.join(ROOT, `${name}/tree.json`)
                const tree = getTree(source, parserOptions)

                await expect(
                    JSON.stringify(tree, replacer, 4),
                ).toMatchFileSnapshot(resultPath)
            })

            it("should scope in the correct order.", async () => {
                const resultPath = path.join(ROOT, `${name}/scope.json`)
                if (!fs.existsSync(resultPath)) {
                    return
                }
                const actualText = scopeToJSON(
                    actual.scopeManager || analyze(actual.ast, options),
                )

                await expect(actualText).toMatchFileSnapshot(resultPath)
            })

            it("should have correct parent properties.", () => {
                validateParent(source, parserOptions)
            })

            const servicesPath = path.join(ROOT, `${name}/services.json`)
            if (fs.existsSync(servicesPath)) {
                it("should have correct services.", async () => {
                    await expect(
                        JSON.stringify(
                            Object.keys(actual.services!).sort(),
                            replacer,
                            4,
                        ),
                    ).toMatchFileSnapshot(servicesPath)
                })
            }
        })
    }
})
