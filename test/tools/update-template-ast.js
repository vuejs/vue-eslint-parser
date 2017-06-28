/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const fs = require("fs")
const path = require("path")
const parse = require("../..").parseForESLint
const traverseNodes = require("../..").AST.traverseNodes

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const ROOT = path.join(__dirname, "../fixtures/ast")
const TARGETS = fs.readdirSync(ROOT)
const PARSER_OPTIONS = {
    comment: true,
    ecmaVersion: 2017,
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
 * Get the traversal order.
 * @param {ASTNode} ast The node to get.
 * @param {string} code The whole source code to check ranges.
 * @returns {(string[])[]} The traversal order.
 */
function getTraversalOrder(ast, code) {
    const retv = []

    if (ast.templateBody != null) {
        traverseNodes(ast.templateBody, {
            enterNode(node) {
                retv.push(["enter", node.type, code.slice(node.range[0], node.range[1])])
            },
            leaveNode(node) {
                retv.push(["leave", node.type, code.slice(node.range[0], node.range[1])])
            },
        })
    }

    return retv
}

//------------------------------------------------------------------------------
// Main
//------------------------------------------------------------------------------

for (const name of TARGETS) {
    const sourcePath = path.join(ROOT, `${name}/source.vue`)
    const astPath = path.join(ROOT, `${name}/ast.json`)
    const traversalPath = path.join(ROOT, `${name}/traversal.json`)
    const source = fs.readFileSync(sourcePath, "utf8")
    const actual = parse(source, Object.assign({filePath: sourcePath}, PARSER_OPTIONS))
    const traversal = getTraversalOrder(actual.ast, source)

    fs.writeFileSync(astPath, JSON.stringify(actual.ast, replacer, 4))
    fs.writeFileSync(traversalPath, JSON.stringify(traversal, replacer, 4))
}
