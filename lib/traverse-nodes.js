/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const KEYS = {
    AssignmentExpression: ["left", "right"],
    AssignmentPattern: ["left", "right"],
    ArrayExpression: ["elements"],
    ArrayPattern: ["elements"],
    ArrowFunctionExpression: ["params", "body"],
    AwaitExpression: ["argument"],
    BlockStatement: ["body"],
    BinaryExpression: ["left", "right"],
    BreakStatement: ["label"],
    CallExpression: ["callee", "arguments"],
    CatchClause: ["param", "body"],
    ClassBody: ["body"],
    ClassDeclaration: ["id", "superClass", "body"],
    ClassExpression: ["id", "superClass", "body"],
    ConditionalExpression: ["test", "consequent", "alternate"],
    ContinueStatement: ["label"],
    DebuggerStatement: [],
    DirectiveStatement: [],
    DoWhileStatement: ["body", "test"],
    EmptyStatement: [],
    ExportAllDeclaration: ["source"],
    ExportDefaultDeclaration: ["declaration"],
    ExportNamedDeclaration: ["declaration", "specifiers", "source"],
    ExportSpecifier: ["exported", "local"],
    ExpressionStatement: ["expression"],
    ForStatement: ["init", "test", "update", "body"],
    ForInStatement: ["left", "right", "body"],
    ForOfStatement: ["left", "right", "body"],
    FunctionDeclaration: ["id", "params", "body"],
    FunctionExpression: ["id", "params", "body"],
    Identifier: [],
    IfStatement: ["test", "consequent", "alternate"],
    ImportDeclaration: ["specifiers", "source"],
    ImportDefaultSpecifier: ["local"],
    ImportNamespaceSpecifier: ["local"],
    ImportSpecifier: ["imported", "local"],
    Literal: [],
    LabeledStatement: ["label", "body"],
    LogicalExpression: ["left", "right"],
    MemberExpression: ["object", "property"],
    MetaProperty: ["meta", "property"],
    MethodDefinition: ["key", "value"],
    ModuleSpecifier: [],
    NewExpression: ["callee", "arguments"],
    ObjectExpression: ["properties"],
    ObjectPattern: ["properties"],
    Program: ["body"],
    Property: ["key", "value"],
    RestElement: ["argument"],
    ReturnStatement: ["argument"],
    SequenceExpression: ["expressions"],
    SpreadElement: ["argument"],
    Super: [],
    SwitchStatement: ["discriminant", "cases"],
    SwitchCase: ["test", "consequent"],
    TaggedTemplateExpression: ["tag", "quasi"],
    TemplateElement: [],
    TemplateLiteral: ["quasis", "expressions"],
    ThisExpression: [],
    ThrowStatement: ["argument"],
    TryStatement: ["block", "handler", "finalizer"],
    UnaryExpression: ["argument"],
    UpdateExpression: ["argument"],
    VariableDeclaration: ["declarations"],
    VariableDeclarator: ["id", "init"],
    WhileStatement: ["test", "body"],
    WithStatement: ["object", "body"],
    YieldExpression: ["argument"],

    VIdentifier: [],
    VText: [],
    VExpressionContainer: ["expression"],
    VForDirectiveValue: ["left", "right"],
    VDirectiveKey: [],
    VAttributeValue: [],
    VAttribute: ["key", "value"],
    VStartTag: ["id", "attributes"],
    VEndTag: ["id"],
    VElement: ["startTag", "children", "endTag"],
}

/**
 * Check that the given key should be traversed or not.
 * @this {ASTNode}
 * @param {string} key The key to check.
 * @returns {boolean} `true` if the key should be traversed.
 */
function fallbackKeysFilter(key) {
    let value = null
    return (
        key !== "comments" &&
        key !== "leadingComments" &&
        key !== "loc" &&
        key !== "parent" &&
        key !== "range" &&
        key !== "tokens" &&
        key !== "trailingComments" &&
        (value = this[key]) !== null &&
        typeof value === "object" &&
        (typeof value.type === "string" || Array.isArray(value))
    )
}

/**
 * Get the keys of the given node to traverse it.
 * @param {ASTNode} node The node to get.
 * @returns {string[]} The keys to traverse.
 */
function getFallbackKeys(node) {
    return Object.keys(node).filter(fallbackKeysFilter, node)
}

/**
 * Traverse the given node.
 * `NodeEventGenerator` supports AST selectors!
 * @param {ASTNode} node The node to traverse.
 * @param {ASTNode|null} parent The parent node.
 * @param {NodeEventGenerator} generator The event generator.
 * @returns {void}
 */
function traverse(node, parent, generator) {
    let i = 0
    let j = 0

    generator.enterNode(node, parent)

    const keys = KEYS[node.type] || getFallbackKeys(node)
    for (i = 0; i < keys.length; ++i) {
        const child = node[keys[i]]

        if (Array.isArray(child)) {
            for (j = 0; j < child.length; ++j) {
                if (child[j]) {
                    traverse(child[j], node, generator)
                }
            }
        }
        else if (child) {
            traverse(child, node, generator)
        }
    }

    generator.leaveNode(node, parent)
}

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

module.exports = (node, generator) => traverse(node, null, generator)
