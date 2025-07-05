import type { Identifier, Node } from "estree"
import type {
    Scope,
    ScopeManager,
    Variable,
    VariableDefinition,
} from "eslint-scope"
import type { ESLintProgram, Token } from "../src/ast"
import type { ParserOptions } from "../src/common/parser-options"
import * as escope from "eslint-scope"

/**
 * Remove `parent` properties from the given AST.
 * @param key The key.
 * @param value The value of the key.
 * @returns The value of the key to output.
 */
export function replacer(key: string, value: any): any {
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
 * @param ast The root node of AST.
 * @returns Tokens.
 */
export function getAllTokens(ast: ESLintProgram): Token[] {
    const tokenArrays = [ast.tokens, ast.comments]
    if (ast.templateBody != null) {
        tokenArrays.push(ast.templateBody.tokens, ast.templateBody.comments)
    }
    return Array.prototype.concat.apply([], tokenArrays)
}

export function scopeToJSON(scopeManager: ScopeManager) {
    return JSON.stringify(normalizeScope(scopeManager.globalScope), replacer, 4)

    function normalizeScope(scope: Scope): any {
        return {
            type: scope.type,
            variables: scope.variables.map(normalizeVar),
            references: scope.references.map(normalizeReference),
            childScopes: scope.childScopes.map(normalizeScope),
            through: scope.through.map(normalizeReference),
        }
    }

    function normalizeVar(v: Variable) {
        return {
            name: v.name,
            identifiers: v.identifiers.map(normalizeId),
            defs: v.defs.map(normalizeDef),
            references: v.references.map(normalizeReference),
        }
    }

    function normalizeReference(reference: any) {
        return {
            identifier: normalizeId(reference.identifier),
            from: reference.from.type,
            resolved: normalizeId(
                reference.resolved &&
                    reference.resolved.defs &&
                    reference.resolved.defs[0] &&
                    reference.resolved.defs[0].name,
            ),
            init: reference.init ?? null,
            vueUsedInTemplate: reference.vueUsedInTemplate
                ? reference.vueUsedInTemplate
                : undefined,
        }
    }

    function normalizeDef(def: VariableDefinition) {
        return {
            type: def.type,
            node: normalizeDefNode(def.node),
            name: def.name.name,
        }
    }

    function normalizeId(identifier: Identifier | null) {
        return (
            identifier && {
                type: identifier.type,
                name: identifier.name,
                loc: identifier.loc,
            }
        )
    }

    function normalizeDefNode(node: Node) {
        return {
            type: node.type,
            loc: node.loc,
        }
    }
}

/**
 * Analyze scope
 */
export function analyze(
    ast: ESLintProgram,
    parserOptions: ParserOptions,
): ScopeManager {
    const ecmaVersion = parserOptions.ecmaVersion ?? 2022
    const ecmaFeatures = parserOptions.ecmaFeatures ?? {}
    const sourceType = parserOptions.sourceType ?? "script"
    const result = escope.analyze(ast, {
        ignoreEval: true,
        nodejsScope: false,
        impliedStrict: ecmaFeatures.impliedStrict,
        ecmaVersion,
        sourceType,
        fallback: getFallbackKeys,
    })

    return result

    function getFallbackKeys(node: any) {
        return Object.keys(node).filter(fallbackKeysFilter, node)
    }

    function fallbackKeysFilter(key: string) {
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
            // @ts-expect-error -- ignore
            (typeof value.type === "string" || Array.isArray(value))
        )
    }
}
