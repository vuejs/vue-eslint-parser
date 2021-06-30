/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import type * as estree from "estree"

export interface AnalysisOptions {
    optimistic?: boolean
    directive?: boolean
    ignoreEval?: boolean
    nodejsScope?: boolean
    impliedStrict?: boolean
    fallback?: string | Function
    sourceType?: "script" | "module"
    ecmaVersion?: number
}

export interface ScopeManager {
    scopes: Scope[]
    globalScope: Scope
    acquire(node: estree.Node, inner: boolean): Scope | null
    acquireAll(node: estree.Node): Scope[]
}

export interface Scope {
    block: estree.Node
    childScopes: Scope[]
    directCallToEcalScope: boolean
    dynamic: boolean
    functionExpressionScope: boolean
    isStrict: boolean
    references: Reference[]
    set: Map<string, Variable>
    taints: Map<string, boolean>
    thisFound: boolean
    through: Reference[]
    type: string
    upper: Scope | null
    variables: Variable[]
    variableScope: Scope
}

export interface Variable {
    defs: VariableDefinition[]
    identifiers: estree.Identifier[]
    name: string
    references: Reference[]
    scope: Scope
    stack: boolean
}

export interface VariableDefinition {
    type: string
    name: estree.Identifier
    node: estree.Node
    parent?: estree.Node
}

export interface Reference {
    from: Scope
    identifier: estree.Identifier
    partial: boolean
    resolved: Variable | null
    tainted: boolean
    writeExpr: estree.Expression

    isRead(): boolean
    isReadOnly(): boolean
    isReadWrite(): boolean
    isStatic(): boolean
    isWrite(): boolean
    isWriteOnly(): boolean
}

declare const eslintScope: {
    analyze(ast: object, options?: AnalysisOptions): ScopeManager
    version: string
}
export default eslintScope
