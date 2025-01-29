"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const fs = require("fs")
const path = require("path")
const parser = require("../src")

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const ROOT = path.join(__dirname, "../test/fixtures/document-fragment")
const TARGETS = fs.readdirSync(ROOT)
const PARSER_OPTIONS = {
    comment: true,
    ecmaVersion: "latest",
    sourceType: "module",
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
    const options = Object.assign(
        { filePath: sourcePath },
        PARSER_OPTIONS,
        optionsPath ? require(optionsPath) : {},
    )
    const result = parser.parseForESLint(source, options)
    const actual = result.services.getDocumentFragment()

    const resultPath = path.join(ROOT, `${name}/document-fragment.json`)
    const tokenRangesPath = path.join(ROOT, `${name}/token-ranges.json`)
    const treePath = path.join(ROOT, `${name}/tree.json`)

    console.log("Update:", name)

    const tokenRanges = getAllTokens(actual).map((t) =>
        source.slice(t.range[0], t.range[1]),
    )
    const tree = getTree(source, actual)

    fs.writeFileSync(resultPath, JSON.stringify(actual, replacer, 4))
    fs.writeFileSync(tokenRangesPath, JSON.stringify(tokenRanges, replacer, 4))
    fs.writeFileSync(treePath, JSON.stringify(tree, replacer, 4))
}

function getAllTokens(fgAst) {
    const tokenArrays = [fgAst.tokens, fgAst.comments]

    return Array.prototype.concat.apply([], tokenArrays)
}

/**
 * Create simple tree.
 * @param {string} source The source code.
 * @param {VDocumentFragment} fgAst The root node.
 * @returns {object} Simple tree.
 */
function getTree(source, fgAst) {
    const stack = []
    const root = { children: [] }
    let current = root

    parser.AST.traverseNodes(fgAst, {
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
