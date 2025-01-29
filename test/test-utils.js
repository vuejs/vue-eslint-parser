const escope = require("eslint-scope")

module.exports = { replacer, getAllTokens, scopeToJSON, analyze }

/**
 * Remove `parent` properties from the given AST.
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
                    reference.resolved.defs[0].name,
            ),
            init: reference.init || null,
            vueUsedInTemplate: reference.vueUsedInTemplate
                ? reference.vueUsedInTemplate
                : undefined,
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
    const ecmaVersion = parserOptions.ecmaVersion || 2022
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
