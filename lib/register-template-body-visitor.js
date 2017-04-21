/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const EventEmitter = require("events")
const NodeEventGenerator = require("eslint/lib/util/node-event-generator")

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const emitters = new WeakMap()
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
    VDirectiveKey: [],
    VAttributeValue: [],
    VAttribute: ["key", "value"],
    VStartTag: ["id", "attributes"],
    VEndTag: ["id"],
    VElement: ["startTag", "children", "endTag"],
}

/**
 * Get the keys of the given node to traverse it.
 * @param {ASTNode} node The node to get.
 * @returns {string[]} The keys to traverse.
 */
function fallback(node) {
    return Object.keys(node).filter(k =>
        k !== "parent" &&
        k !== "leadingComments" &&
        k !== "trailingComments" &&
        node[k] !== null &&
        typeof node[k] === "object"
    )
}

/**
 * Traverse the given node.
 * `NodeEventGenerator` supports AST selectors!
 * @param {ASTNode} node The node to traverse.
 * @param {NodeEventGenerator} generator The event generator.
 * @returns {void}
 */
function traverse(node, generator) {
    let i = 0
    let j = 0

    generator.enterNode(node)

    const keys = KEYS[node.type] || fallback(node)
    for (i = 0; i < keys.length; ++i) {
        const child = node[keys[i]]

        if (Array.isArray(child)) {
            for (j = 0; j < child.length; ++j) {
                if (child[j]) {
                    traverse(child[j], generator)
                }
            }
        }
        else if (child) {
            traverse(child, generator)
        }
    }

    generator.leaveNode(node)
}

/**
 * Get or create the event emitter to traverse.
 * @param {RuleContext} context The rule context.
 * @returns {EventEmitter} The emitter for this context.
 */
function ensureEmitter(context) {
    const key = context.getSourceCode()
    if (emitters.has(key)) {
        return emitters.get(key)
    }
    const emitter = new EventEmitter()
    emitters.set(key, emitter)

    // Traverse
    context.eslint.on("Program:exit", (node) => {
        if (node.templateBody != null) {
            const generator = new NodeEventGenerator(emitter)
            traverse(node.templateBody, generator)
        }
    })

    return emitter
}

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

module.exports = (context, visitor) => {
    const emitter = ensureEmitter(context)

    for (const selector of Object.keys(visitor)) {
        emitter.on(selector, visitor[selector])
    }
}
module.exports.traverse = traverse
