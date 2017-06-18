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
const parse = require("..").parseForESLint
const traverseNodes = require("../lib/traverse-nodes")
const RuleContext = require("./stub-rule-context")

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const ROOT = path.join(__dirname, "fixtures/template-ast")
const TARGETS = fs.readdirSync(ROOT)
    .filter(name => name.endsWith(".source.vue"))
    .map(name => path.basename(name, ".source.vue"))
const PARSER_OPTIONS = {
    comment: true,
    ecmaVersion: 6,
    loc: true,
    range: true,
    tokens: true,
}

/**
 * Remove `parent` proeprties from the given AST.
 * @param {ASTNode} ast The node to remove.
 * @returns {void}
 */
function removeParent(ast) {
    if (ast.templateBody != null) {
        traverseNodes(ast.templateBody, {
            enterNode(node) {
                delete node.parent
            },
            leaveNode() {
                // do nothing.
            },
        })
    }
}

/**
 * Get information of tokens.
 * This uses source code text to check the ranges of tokens.
 * @param {ASTNode} ast The root node of AST.
 * @param {string} code The whole source code.
 * @returns {(string[])[]} Information of tokens.
 */
function getTokens(ast, code) {
    return (ast.templateBody == null)
        ? []
        : ast.templateBody.tokens.map(t => [t.type, code.slice(t.range[0], t.range[1])])
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
        const sourcePath = path.join(ROOT, `${name}.source.vue`)
        const source = fs.readFileSync(sourcePath, "utf8")
        const actual = parse(source, Object.assign({filePath: sourcePath}, PARSER_OPTIONS))
        removeParent(actual.ast)

        it(`'${name}' should parsed to valid AST.`, () => {
            const resultPath = path.join(ROOT, `${name}.ast.json`)
            const expected = fs.readFileSync(resultPath, "utf8")

            assert.strictEqual(
                JSON.stringify(actual.ast, null, 4),
                expected
            )
        })

        it(`'${name}' should parsed to valid tokens.`, () => {
            const resultPath = path.join(ROOT, `${name}.tokens.json`)
            const expected = fs.readFileSync(resultPath, "utf8")

            assert.strictEqual(
                JSON.stringify(getTokens(actual.ast, source), null, 4),
                expected
            )
        })

        it(`'${name}' should traverse in the valid order.`, () => {
            const resultPath = path.join(ROOT, `${name}.traversal.json`)
            const expected = fs.readFileSync(resultPath, "utf8")

            assert.strictEqual(
                JSON.stringify(getTraversal(actual, source), null, 4),
                expected
            )
        })
    }
})
