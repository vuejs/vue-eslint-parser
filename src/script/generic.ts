import type {
    ESLintExtendedProgram,
    ESLintProgram,
    HasLocation,
    Token,
    VElement,
    VGenericExpression,
} from "../ast"
// eslint-disable-next-line node/no-extraneous-import -- ignore
import type { TSESTree } from "@typescript-eslint/utils"
import type {
    Reference,
    Scope,
    Variable,
    ScopeManager,
    VariableDefinition,
} from "eslint-scope"
import { findGenericDirective } from "../common/ast-utils"

export type GenericProcessInfo = {
    node: VGenericExpression
    defineTypes: {
        node: VGenericExpression["params"][number]
        define: string
    }[]
    postprocess: (context: GenericPostprocessContext) => void
}
export type GenericPostprocessContext = {
    result: ESLintExtendedProgram
    getTypeBlock?: (node: ESLintProgram) => {
        body: ESLintProgram["body"]
    }
    isRemoveTarget: (nodeOrToken: HasLocation) => boolean
    getTypeDefScope: (scopeManager: ScopeManager) => Scope
}
export function extractGeneric(element: VElement): GenericProcessInfo | null {
    const genericAttr = findGenericDirective(element)
    if (!genericAttr) {
        return null
    }
    const genericNode = genericAttr.value.expression
    const defineTypes = genericNode.params.map((t, i) => ({
        node: t,
        define: `type ${t.name.name} = ${getConstraint(
            t,
            genericNode.rawParams[i],
        )}`,
    }))

    return {
        node: genericNode,
        defineTypes,
        postprocess({ result, getTypeBlock, isRemoveTarget, getTypeDefScope }) {
            const node = getTypeBlock?.(result.ast) ?? result.ast
            removeTypeDeclarations(node, isRemoveTarget)
            if (result.ast.tokens) {
                removeTypeDeclarationTokens(result.ast.tokens, isRemoveTarget)
            }
            if (result.ast.comments) {
                removeTypeDeclarationTokens(result.ast.comments, isRemoveTarget)
            }
            if (result.scopeManager) {
                const typeDefScope = getTypeDefScope(result.scopeManager)
                restoreScope(result.scopeManager, typeDefScope, isRemoveTarget)
            }
        },
    }

    function removeTypeDeclarations(
        node: {
            body: ESLintProgram["body"]
        },
        isRemoveTarget: (nodeOrToken: HasLocation) => boolean,
    ) {
        for (let index = node.body.length - 1; index >= 0; index--) {
            if (isRemoveTarget(node.body[index])) {
                node.body.splice(index, 1)
            }
        }
    }

    function removeTypeDeclarationTokens(
        tokens: Token[],
        isRemoveTarget: (nodeOrToken: HasLocation) => boolean,
    ) {
        for (let index = tokens.length - 1; index >= 0; index--) {
            if (isRemoveTarget(tokens[index])) {
                tokens.splice(index, 1)
            }
        }
    }

    function restoreScope(
        scopeManager: ScopeManager,
        typeDefScope: Scope,
        isRemoveTarget: (nodeOrToken: HasLocation) => boolean,
    ) {
        for (const variable of [...typeDefScope.variables]) {
            let def = variable.defs.find((d) =>
                isRemoveTarget(d.name as HasLocation),
            )
            while (def) {
                removeVariableDef(variable, def, typeDefScope)
                def = variable.defs.find((d) =>
                    isRemoveTarget(d.name as HasLocation),
                )
            }
        }
        for (const reference of [...typeDefScope.references]) {
            if (isRemoveTarget(reference.identifier as HasLocation)) {
                removeReference(reference, typeDefScope)
            }
        }

        for (const scope of [...scopeManager.scopes]) {
            if (isRemoveTarget(scope.block as HasLocation)) {
                removeScope(scopeManager, scope)
            }
        }
    }
}

function getConstraint(node: TSESTree.TSTypeParameter, rawParam: string) {
    if (!node.constraint) {
        return "unknown"
    }
    let index = rawParam.indexOf(node.name.name) + node.name.name.length
    let startIndex: number | null = null
    while (index < rawParam.length) {
        if (startIndex == null) {
            if (rawParam.startsWith("extends", index)) {
                startIndex = index = index + 7
                continue
            }
        } else if (rawParam[index] === "=") {
            if (rawParam[index + 1] === ">") {
                // Arrow function type
                index += 2
                continue
            }
            return rawParam.slice(startIndex, index)
        }
        if (rawParam.startsWith("//", index)) {
            // Skip line comment
            const lfIndex = rawParam.indexOf("\n", index)
            if (lfIndex >= 0) {
                index = lfIndex + 1
                continue
            }
            return "unknown"
        }
        if (rawParam.startsWith("/*", index)) {
            // Skip block comment
            const endIndex = rawParam.indexOf("*/", index)
            if (endIndex >= 0) {
                index = endIndex + 2
                continue
            }
            return "unknown"
        }
        index++
    }
    if (startIndex == null) {
        return "unknown"
    }

    return rawParam.slice(startIndex)
}

/** Remove variable def */
function removeVariableDef(
    variable: Variable,
    def: VariableDefinition,
    scope: Scope,
): void {
    const defIndex = variable.defs.indexOf(def)
    if (defIndex < 0) {
        return
    }
    variable.defs.splice(defIndex, 1)
    if (variable.defs.length === 0) {
        // Remove variable
        referencesToThrough(variable.references, scope)
        variable.references.forEach((r) => {
            if ((r as any).init) {
                ;(r as any).init = false
            }
            r.resolved = null
        })
        scope.variables.splice(scope.variables.indexOf(variable), 1)
        const name = variable.name
        if (variable === scope.set.get(name)) {
            scope.set.delete(name)
        }
    } else {
        const idIndex = variable.identifiers.indexOf(def.name)
        if (idIndex >= 0) {
            variable.identifiers.splice(idIndex, 1)
        }
    }
}

/** Move reference to through */
function referencesToThrough(references: Reference[], baseScope: Scope) {
    let scope: Scope | null = baseScope
    while (scope) {
        addAllReferences(scope.through, references)
        scope = scope.upper
    }
}

/**
 * Add all references to array
 */
function addAllReferences(list: Reference[], elements: Reference[]): void {
    list.push(...elements)
    list.sort((a, b) => a.identifier.range![0] - b.identifier.range![0])
}

/** Remove reference */
function removeReference(reference: Reference, baseScope: Scope): void {
    if (reference.resolved) {
        if (
            reference.resolved.defs.some((d) => d.name === reference.identifier)
        ) {
            // remove var
            const varIndex = baseScope.variables.indexOf(reference.resolved)
            if (varIndex >= 0) {
                baseScope.variables.splice(varIndex, 1)
            }
            const name = reference.identifier.name
            if (reference.resolved === baseScope.set.get(name)) {
                baseScope.set.delete(name)
            }
        } else {
            const refIndex = reference.resolved.references.indexOf(reference)
            if (refIndex >= 0) {
                reference.resolved.references.splice(refIndex, 1)
            }
        }
    }

    let scope: Scope | null = baseScope
    while (scope) {
        const refIndex = scope.references.indexOf(reference)
        if (refIndex >= 0) {
            scope.references.splice(refIndex, 1)
        }
        const throughIndex = scope.through.indexOf(reference)
        if (throughIndex >= 0) {
            scope.through.splice(throughIndex, 1)
        }
        scope = scope.upper
    }
}

/** Remove scope */
function removeScope(scopeManager: ScopeManager, scope: Scope): void {
    for (const childScope of scope.childScopes) {
        removeScope(scopeManager, childScope)
    }

    while (scope.references[0]) {
        removeReference(scope.references[0], scope)
    }
    const upper = scope.upper
    if (upper) {
        const index = upper.childScopes.indexOf(scope)
        if (index >= 0) {
            upper.childScopes.splice(index, 1)
        }
    }
    const index = scopeManager.scopes.indexOf(scope)
    if (index >= 0) {
        scopeManager.scopes.splice(index, 1)
    }
}
