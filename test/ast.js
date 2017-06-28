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
const parser = require("..")
const RuleContext = require("./stub-rule-context")

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const ROOT = path.join(__dirname, "fixtures/ast")
const TARGETS = fs.readdirSync(ROOT)
const PARSER_OPTIONS = {
    comment: true,
    ecmaVersion: 6,
    loc: true,
    range: true,
    tokens: true,
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
        return value.map(e => ({
            message: e.message,
            index: e.index,
            lineNumber: e.lineNumber,
            column: e.column,
        }))
    }
    return value
}

/**
 * Get information of tokens.
 * This uses source code text to check the ranges of tokens.
 * @param {ASTNode} ast The root node of AST.
 * @returns {(string[])[]} Information of tokens.
 */
function getAllTokens(ast) {
    const tokenArrays = [ast.tokens, ast.comments]
    if (ast.templateBody != null) {
        tokenArrays.push(ast.templateBody.tokens, ast.templateBody.comments)
    }
    return Array.prototype.concat.apply([], tokenArrays)
}

/**
 * Get information of tokens.
 * This uses source code text to check the ranges of tokens.
 * @param {{ast:ASTNode,services:object}} result The parsing result.
 * @param {string} code The whole source code.
 * @returns {(string[])[]} Information of tokens.
 */
function getTraversal(result, code) {
    const retv = []
    const ruleContext = new RuleContext(code, result.ast)

    result.services.registerTemplateBodyVisitor(ruleContext, {
        "*"(node) {
            retv.push([
                "enter",
                node.type,
                code.slice(node.range[0], node.range[1]),
            ])
        },
        "*:exit"(node) {
            retv.push([
                "leave",
                node.type,
                code.slice(node.range[0], node.range[1]),
            ])
        },
    })
    ruleContext.traverseThisAst()

    return retv
}

//------------------------------------------------------------------------------
// Main
//------------------------------------------------------------------------------

describe("Template AST", () => {
    for (const name of TARGETS) {
        const sourcePath = path.join(ROOT, `${name}/source.vue`)
        const source = fs.readFileSync(sourcePath, "utf8")
        const actual = parser.parseForESLint(source, Object.assign({filePath: sourcePath}, PARSER_OPTIONS))

        describe(`'test/fixtures/ast/${name}/source.vue'`, () => {
            it("should be parsed to valid AST.", () => {
                const resultPath = path.join(ROOT, `${name}/ast.json`)
                const expected = fs.readFileSync(resultPath, "utf8")

                assert.strictEqual(
                    JSON.stringify(actual.ast, replacer, 4),
                    expected
                )
            })

            it("should have correct range.", () => {
                for (const token of getAllTokens(actual.ast)) {
                    if (token.raw === undefined) {
                        continue
                    }

                    const text = source.slice(token.range[0], token.range[1])
                    assert.strictEqual(text, token.raw)
                }
            })

            it("should have correct location.", () => {
                const lines = source.match(/[^\r\n]*\r?\n/g) || []
                lines.push(String.fromCodePoint(0))
                for (const token of getAllTokens(actual.ast)) {
                    const line0 = token.loc.start.line - 1
                    const line1 = token.loc.end.line - 1
                    const column0 = token.loc.start.column
                    const column1 = token.loc.end.column
                    const expected = source.slice(token.range[0], token.range[1])

                    let text = ""
                    if (line0 === line1) {
                        text = lines[line0].slice(column0, column1)
                    }
                    else {
                        text = lines[line0].slice(column0)
                        for (let i = line0 + 1; i < line1; ++i) {
                            text += lines[i]
                        }
                        text += lines[line1].slice(0, column1)
                    }

                    assert.strictEqual(
                        text,
                        expected,
                        `${JSON.stringify(token, null, 4)} expected ${JSON.stringify(expected)}, but got ${JSON.stringify(text)}`
                    )
                }
            })

            it("should be traversed in the correct order.", () => {
                const resultPath = path.join(ROOT, `${name}/traversal.json`)
                const expected = fs.readFileSync(resultPath, "utf8")

                assert.strictEqual(
                    JSON.stringify(getTraversal(actual, source), replacer, 4),
                    expected
                )
            })
        })
    }
})
