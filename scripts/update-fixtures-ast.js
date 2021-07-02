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
const parser = require("../")
const escope = require("eslint-scope")
const semver = require("semver")

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const ROOT = path.join(__dirname, "../test/fixtures/ast")
const TARGETS = fs.readdirSync(ROOT)
const PARSER_OPTIONS = {
    comment: true,
    ecmaVersion: 2020,
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

/**
 * Get all tokens of the given AST.
 * @param {ASTNode} ast The root node of AST.
 * @returns {Token[]} Tokens.
 */
function getAllTokens(ast) {
    const tokenArrays = [ast.tokens, ast.comments]
    if (ast.templateBody != null) {
        tokenArrays.push(ast.templateBody.tokens, ast.templateBody.comments)
    }
    return Array.prototype.concat.apply([], tokenArrays)
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
                })
            )
        },
        leaveNode() {
            current = stack.pop()
        },
    })

    return root.children
}

function scopeToJSON(scopeManager) {
    return JSON.stringify(normalizeScope(scopeManager.globalScope), replacer, 4)

    function normalizeScope(scope) {
        return {
            type: scope.type,
            variables: scope.variables.map(normalizeVar),
            references: scope.references.map(normalizeReference),
            childScopes: scope.childScopes.map(normalizeScope),
            through: scope.through.map(normalizeReference),
        }
    }

    function normalizeVar(v) {
        return {
            name: v.name,
            identifiers: v.identifiers.map(normalizeId),
            defs: v.defs.map(normalizeDef),
            references: v.references.map(normalizeReference),
        }
    }

    function normalizeReference(reference) {
        return {
            identifier: normalizeId(reference.identifier),
            from: reference.from.type,
            resolved: normalizeId(
                reference.resolved &&
                    reference.resolved.defs &&
                    reference.resolved.defs[0] &&
                    reference.resolved.defs[0].name
            ),
            init: reference.init || null,
        }
    }

    function normalizeDef(def) {
        return {
            type: def.type,
            node: normalizeDefNode(def.node),
            name: def.name.name,
        }
    }

    function normalizeId(identifier) {
        return (
            identifier && {
                type: identifier.type,
                name: identifier.name,
                loc: identifier.loc,
            }
        )
    }

    function normalizeDefNode(node) {
        return {
            type: node.type,
            loc: node.loc,
        }
    }
}

/**
 * Analyze scope
 */
function analyze(ast, parserOptions) {
    const ecmaVersion = parserOptions.ecmaVersion || 2017
    const ecmaFeatures = parserOptions.ecmaFeatures || {}
    const sourceType = parserOptions.sourceType || "script"
    const result = escope.analyze(ast, {
        ignoreEval: true,
        nodejsScope: false,
        impliedStrict: ecmaFeatures.impliedStrict,
        ecmaVersion,
        sourceType,
        fallback: getFallbackKeys,
    })

    return result

    function getFallbackKeys(node) {
        return Object.keys(node).filter(fallbackKeysFilter, node)
    }

    function fallbackKeysFilter(key) {
        const value = null
        return (
            key !== "comments" &&
            key !== "leadingComments" &&
            key !== "loc" &&
            key !== "parent" &&
            key !== "range" &&
            key !== "tokens" &&
            key !== "trailingComments" &&
            typeof value === "object" &&
            (typeof value.type === "string" || Array.isArray(value))
        )
    }
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
            const pkg = require(`${pkgName}/package.json`)
            return !semver.satisfies(pkg.version, pkgVersion)
        })
    ) {
        continue
    }
    const sourcePath = path.join(ROOT, `${name}/source.vue`)
    const optionsPath = path.join(ROOT, `${name}/parser-options.json`)
    const astPath = path.join(ROOT, `${name}/ast.json`)
    const tokenRangesPath = path.join(ROOT, `${name}/token-ranges.json`)
    const treePath = path.join(ROOT, `${name}/tree.json`)
    const scopePath = path.join(ROOT, `${name}/scope.json`)
    const source = fs.readFileSync(sourcePath, "utf8")
    const options = Object.assign(
        { filePath: sourcePath },
        PARSER_OPTIONS,
        fs.existsSync(optionsPath)
            ? JSON.parse(fs.readFileSync(optionsPath, "utf8"))
            : {}
    )
    const actual = parser.parseForESLint(source, options)
    const tokenRanges = getAllTokens(actual.ast).map((t) =>
        source.slice(t.range[0], t.range[1])
    )
    const tree = getTree(source, actual.ast)

    console.log("Update:", name)

    fs.writeFileSync(astPath, JSON.stringify(actual.ast, replacer, 4))
    fs.writeFileSync(tokenRangesPath, JSON.stringify(tokenRanges, replacer, 4))
    fs.writeFileSync(treePath, JSON.stringify(tree, replacer, 4))
    if (fs.existsSync(scopePath)) {
        fs.writeFileSync(
            scopePath,
            scopeToJSON(actual.scopeManager || analyze(actual.ast, options))
        )
    }
}
