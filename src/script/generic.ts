import type {
    ESLintExtendedProgram,
    ESLintProgram,
    HasLocation,
    Token,
    VElement,
    VGenericTypeParameterDeclarationExpression,
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
    node: VGenericTypeParameterDeclarationExpression
    defineTypes: {
        node: VGenericTypeParameterDeclarationExpression["params"][number]
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
    const defineTypes = genericNode.params.map((t) => ({
        node: t,
        define: `type ${t.name.name} = ${
            t.constraint ? getConstraint(t.constraint, genericNode) : "unknown"
        }`,
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

function getConstraint(
    node: TSESTree.TypeNode,
    expr: VGenericTypeParameterDeclarationExpression,
) {
    const start = expr.params[0].range[0]
    return expr.rawParams.slice(node.range[0] - start, node.range[1] - start)
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
    addElementsToSortedArray(
        list,
        elements,
        (a, b) => a.identifier.range![0] - b.identifier.range![0],
    )
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

/**
 * Add element to a sorted array
 */
function addElementsToSortedArray<T>(
    array: T[],
    elements: T[],
    compare: (a: T, b: T) => number,
): void {
    if (!elements.length) {
        return
    }
    let last = elements[0]
    let index = sortedLastIndex(array, (target) => compare(target, last))
    for (const element of elements) {
        if (compare(last, element) > 0) {
            index = sortedLastIndex(array, (target) => compare(target, element))
        }
        let e = array[index]
        while (e && compare(e, element) <= 0) {
            e = array[++index]
        }
        array.splice(index, 0, element)
        last = element
    }
}

/**
 * Uses a binary search to determine the highest index at which value should be inserted into array in order to maintain its sort order.
 */
function sortedLastIndex<T>(
    array: T[],
    compare: (target: T) => number,
): number {
    let lower = 0
    let upper = array.length

    while (lower < upper) {
        const mid = Math.floor(lower + (upper - lower) / 2)
        const target = compare(array[mid])
        if (target < 0) {
            lower = mid + 1
        } else if (target > 0) {
            upper = mid
        } else {
            return mid + 1
        }
    }

    return upper
}
