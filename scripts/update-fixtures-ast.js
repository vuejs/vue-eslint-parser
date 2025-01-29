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
const parser = require("../src")
const semver = require("semver")
const {
    scopeToJSON,
    analyze,
    replacer,
    getAllTokens,
} = require("../test/test-utils")

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const ROOT = path.join(__dirname, "../test/fixtures/ast")
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
 * @param {ASTNode} ast The root node.
 * @returns {object} Simple tree.
 */
function getTree(source, ast) {
    if (ast.templateBody == null) {
        return []
    }

    const stack = []
    const root = { children: [] }
    let current = root

    parser.AST.traverseNodes(ast.templateBody, {
        enterNode(node) {
            stack.push(current)
            current.children.push(
                (current = {
                    type: node.type,
                    text: source.slice(node.range[0], node.range[1]),
                    children: [],
                }),
            )
        },
        leaveNode() {
            current = stack.pop()
        },
    })

    return root.children
}

//------------------------------------------------------------------------------
// Main
//------------------------------------------------------------------------------

for (const name of TARGETS) {
    const requirementsPath = path.join(ROOT, `${name}/requirements.json`)
    const requirements = fs.existsSync(requirementsPath)
        ? JSON.parse(fs.readFileSync(requirementsPath, "utf8"))
        : {}
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
    const sourcePath = path.join(ROOT, `${name}/source.vue`)
    const optionsPath = [
        path.join(ROOT, `${name}/parser-options.json`),
        path.join(ROOT, `${name}/parser-options.js`),
    ].find((fp) => fs.existsSync(fp))
    const astPath = path.join(ROOT, `${name}/ast.json`)
    const tokenRangesPath = path.join(ROOT, `${name}/token-ranges.json`)
    const treePath = path.join(ROOT, `${name}/tree.json`)
    const scopePath = path.join(ROOT, `${name}/scope.json`)
    const servicesPath = path.join(ROOT, `${name}/services.json`)
    const source = fs.readFileSync(sourcePath, "utf8")
    const parserOptions = optionsPath ? require(optionsPath) : {}
    const options = {
        filePath: sourcePath,
        ...PARSER_OPTIONS,
        ...parserOptions,
    }
    // console.log("Start:", name)
    const actual = parser.parseForESLint(source, options)
    const tokenRanges = getAllTokens(actual.ast).map((t) =>
        source.slice(t.range[0], t.range[1]),
    )
    const tree = getTree(source, actual.ast)

    console.log("Update:", name)

    fs.writeFileSync(astPath, JSON.stringify(actual.ast, replacer, 4))
    fs.writeFileSync(tokenRangesPath, JSON.stringify(tokenRanges, replacer, 4))
    fs.writeFileSync(treePath, JSON.stringify(tree, replacer, 4))
    if (fs.existsSync(scopePath)) {
        fs.writeFileSync(
            scopePath,
            scopeToJSON(actual.scopeManager || analyze(actual.ast, options)),
        )
    }
    if (fs.existsSync(servicesPath)) {
        fs.writeFileSync(
            servicesPath,
            JSON.stringify(Object.keys(actual.services).sort(), null, 4),
        )
    }
}
