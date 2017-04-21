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
const parse = require("../..").parse
const traverse = require("../../lib/register-template-body-visitor").traverse

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const ROOT = path.join(__dirname, "../fixtures/template-ast")
const TARGETS = fs.readdirSync(ROOT)
    .filter(name => name.endsWith(".source.vue"))
    .map(name => path.basename(name, ".source.vue"))
const PARSER_OPTIONS = {
    comments: true,
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
        traverse(ast.templateBody, {
            enterNode(node) {
                delete node.parent
            },
            leaveNode() {
                // do nothing.
            },
        })
    }
}

function getTraversalOrder(ast, code) {
    const retv = []

    if (ast.templateBody != null) {
        traverse(ast.templateBody, {
            enterNode(node) {
                if (node.range == null) {
                    console.log(node)
                }
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
    const sourcePath = path.join(ROOT, `${name}.source.vue`)
    const astPath = path.join(ROOT, `${name}.ast.json`)
    const tokensPath = path.join(ROOT, `${name}.tokens.json`)
    const traversalPath = path.join(ROOT, `${name}.traversal.json`)
    const source = fs.readFileSync(sourcePath, "utf8")
    const actual = parse(source, Object.assign({filePath: sourcePath}, PARSER_OPTIONS))
    const tokens = (actual.ast.templateBody == null)
        ? []
        : actual.ast.templateBody.tokens.map(t => [t.type, source.slice(t.range[0], t.range[1])])
    const traversal = getTraversalOrder(actual.ast, source)

    removeParent(actual.ast, source)

    fs.writeFileSync(astPath, JSON.stringify(actual.ast, null, 4))
    fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 4))
    fs.writeFileSync(traversalPath, JSON.stringify(traversal, null, 4))
}
