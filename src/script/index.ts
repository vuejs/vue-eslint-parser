/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import * as lodash from "lodash"
import {traverseNodes, ESLintArrayPattern, ESLintBlockStatement, ESLintExpression, ESLintExpressionStatement, ESLintExtendedProgram, ESLintForInStatement, ESLintForOfStatement, ESLintPattern, ESLintProgram, ESLintVariableDeclaration, Node, ParseError, Reference, Token, Variable, VElement, VForExpression, VOnExpression} from "../ast"
import {debug} from "../common/debug"
import {LocationCalculator} from "../common/location-calculator"
import {analyzeExternalReferences, analyzeVariablesAndExternalReferences} from "./scope-analyzer"

// [1] = spacing before the aliases.
// [2] = aliases.
// [3] = all after the aliases.
const ALIAS_PARENS = /^(\s*)\(([\s\S]+)\)(\s*(?:in|of)\b[\s\S]+)$/
const DUMMY_PARENT: any = {}

/**
 * The interface of ESLint custom parsers.
 */
interface ESLintCustomParser {
    parse(code: string, options: any): ESLintCustomParserResult
    parseForESLint?(code: string, options: any): ESLintCustomParserResult
}

/**
 * Do post-process of parsing an expression.
 *
 * 1. Set `node.parent`.
 * 2. Fix `node.range` and `node.loc` for HTML entities.
 *
 * @param ast The AST root node to modify.
 * @param locationCalculator The location calculator to modify.
 */
function postprocess(ast: ESLintProgram, locationCalculator: LocationCalculator): void {
    // There are cases which the same node instance appears twice in the tree.
    // E.g. `let {a} = {}` // This `a` appears twice at `Property#key` and `Property#value`.
    const traversed = new Set<Node>()

    traverseNodes(ast, {
        enterNode(node, parent) {
            if (!traversed.has(node)) {
                traversed.add(node)
                node.parent = parent
                locationCalculator.fixLocation(node)
            }
        },
        leaveNode() {
            // Do nothing.
        },
    })

    for (const token of ast.tokens || []) {
        locationCalculator.fixLocation(token)
    }
    for (const comment of ast.comments || []) {
        locationCalculator.fixLocation(comment)
    }
}

/**
 * Replace parentheses which wrap the alias of 'v-for' directive values by array brackets in order to avoid syntax errors.
 * @param code The code to replace.
 * @returns The replaced code.
 */
function replaceAliasParens(code: string): string {
    const match = ALIAS_PARENS.exec(code)
    if (match != null) {
        return `${match[1]}[${match[2]}]${match[3]}`
    }
    return code
}

/**
 * Normalize the `ForXStatement#left` node to parse v-for expressions.
 * @param left The `ForXStatement#left` node to normalize.
 * @param replaced The flag to indicate that the alias parentheses were replaced.
 */
function normalizeLeft(left: ESLintVariableDeclaration | ESLintPattern, replaced: boolean): ESLintPattern[] {
    if (left.type !== "VariableDeclaration") {
        throw new Error("unreachable")
    }
    const id = left.declarations[0].id

    if (replaced) {
        return (id as ESLintArrayPattern).elements
    }
    return [id]
}

/**
 * Remove references by name.
 * @param references The array of references to remove.
 * @param name The name of target references.
 */
function removeByName(references: Reference[], name: string): void {
    let i = 0
    while (i < references.length) {
        const reference = references[i]

        if (reference.id.name === name) {
            references.splice(i, 1)
        }
        else {
            i += 1
        }
    }
}

/**
 * Parse the given source code.
 *
 * @param code The source code to parse.
 * @param locationCalculator The location calculator for postprocess.
 * @param parserOptions The parser options.
 * @returns The result of parsing.
 */
function parseScriptFragment(code: string, locationCalculator: LocationCalculator, parserOptions: any): ESLintExtendedProgram {
    try {
        const result = parseScript(code, parserOptions)
        postprocess(result.ast, locationCalculator)
        return result
    }
    catch (err) {
        const perr = ParseError.normalize(err)
        if (perr) {
            locationCalculator.fixErrorLocation(perr)
            throw perr
        }
        throw err
    }
}

/**
 * The result of parsing expressions.
 */
export interface ExpressionParseResult {
    expression: ESLintExpression | VForExpression | VOnExpression
    tokens: Token[]
    comments: Token[]
    references: Reference[]
    variables: Variable[]
}

/**
 * The interface of a result of ESLint custom parser.
 */
export type ESLintCustomParserResult = ESLintProgram | ESLintExtendedProgram


/**
 * Parse the given source code.
 *
 * @param code The source code to parse.
 * @param parserOptions The parser options.
 * @returns The result of parsing.
 */
export function parseScript(code: string, parserOptions: any): ESLintExtendedProgram {
    const parser: ESLintCustomParser = require(parserOptions.parser || "espree") //eslint-disable-line no-restricted-globals
    const result: any = (typeof parser.parseForESLint === "function")
        ? parser.parseForESLint(code, parserOptions)
        : parser.parse(code, parserOptions)

    if (result.ast != null) {
        return result
    }
    return {ast: result}
}

/**
 * Parse the source code of the given `<script>` element.
 * @param node The `<script>` element to parse.
 * @param globalLocationCalculator The location calculator for postprocess.
 * @param parserOptions The parser options.
 * @returns The result of parsing.
 */
export function parseScriptElement(node: VElement, globalLocationCalculator: LocationCalculator, parserOptions: any): ESLintExtendedProgram {
    const text = node.children[0]
    const offset = (text != null && text.type === "VText") ? text.range[0] : node.startTag.range[1]
    const code = (text != null && text.type === "VText") ? text.value : ""
    const locationCalculator = globalLocationCalculator.getSubCalculatorAfter(offset)
    const result = parseScriptFragment(code, locationCalculator, parserOptions)

    // Needs the tokens of start/end tags for `lines-around-*` rules to work
    // correctly.
    if (result.ast.tokens != null) {
        const startTag = node.startTag
        const endTag = node.endTag

        if (startTag != null) {
            result.ast.tokens.unshift({
                type: "Punctuator",
                range: startTag.range,
                loc: startTag.loc,
                value: "<script>",
            })
        }
        if (endTag != null) {
            result.ast.tokens.push({
                type: "Punctuator",
                range: endTag.range,
                loc: endTag.loc,
                value: "</script>",
            })
        }
    }

    return result
}

/**
 * Parse the source code of inline scripts.
 * @param code The source code of inline scripts.
 * @param locationCalculator The location calculator for the inline script.
 * @param parserOptions The parser options.
 * @returns The result of parsing.
 */
export function parseExpression(code: string, locationCalculator: LocationCalculator, parserOptions: any): ExpressionParseResult {
    debug("[script] parse expression: \"(%s)\"", code)

    const ast = parseScriptFragment(
        `(${code})`,
        locationCalculator.getSubCalculatorAfter(-1),
        parserOptions
    ).ast
    const references = analyzeExternalReferences(ast, parserOptions)
    const expression = (ast.body[0] as ESLintExpressionStatement).expression
    const tokens = ast.tokens || []
    const comments = ast.comments || []

    // Remvoe parens.
    tokens.shift()
    tokens.pop()

    return {expression, tokens, comments, references, variables: []}
}

/**
 * Parse the source code of inline scripts.
 * @param code The source code of inline scripts.
 * @param locationCalculator The location calculator for the inline script.
 * @param parserOptions The parser options.
 * @returns The result of parsing.
 */
export function parseVForExpression(code: string, locationCalculator: LocationCalculator, parserOptions: any): ExpressionParseResult {
    const processedCode = replaceAliasParens(code)
    debug("[script] parse v-for expression: \"for(%s);\"", processedCode)

    const replaced = processedCode !== code
    const ast = parseScriptFragment(
        `for(let ${processedCode});`,
        locationCalculator.getSubCalculatorAfter(-8),
        parserOptions
    ).ast
    const tokens = ast.tokens || []
    const comments = ast.comments || []
    const scope = analyzeVariablesAndExternalReferences(ast, parserOptions)
    const references = scope.references
    const variables = scope.variables
    const statement = ast.body[0] as (ESLintForInStatement | ESLintForOfStatement)
    const left = normalizeLeft(statement.left, replaced)
    const right = statement.right
    const firstToken = tokens[3] || statement.left
    const lastToken = tokens[tokens.length - 3] || statement.right
    const expression: VForExpression = {
        type: "VForExpression",
        range: [firstToken.range[0], lastToken.range[1]],
        loc: {start: firstToken.loc.start, end: lastToken.loc.end},
        parent: DUMMY_PARENT,
        left,
        right,
    }

    // Modify parent.
    for (const l of left) {
        if (l != null) {
            l.parent = expression
        }
    }
    right.parent = expression

    // Remvoe `for` `(` `let` `)` `;`.
    tokens.shift()
    tokens.shift()
    tokens.shift()
    tokens.pop()
    tokens.pop()

    // Restore parentheses from array brackets.
    if (replaced) {
        const closeOffset = statement.left.range[1] - 1
        const open = tokens[0]
        const close = tokens.find(t => t.range[0] === closeOffset)

        if (open != null) {
            open.value = "("
        }
        if (close != null) {
            close.value = ")"
        }
    }

    return {expression, tokens, comments, references, variables}
}

/**
 * Parse the source code of inline scripts.
 * @param code The source code of inline scripts.
 * @param locationCalculator The location calculator for the inline script.
 * @param parserOptions The parser options.
 * @returns The result of parsing.
 */
export function parseVOnExpression(code: string, locationCalculator: LocationCalculator, parserOptions: any): ExpressionParseResult {
    debug("[script] parse v-on expression: \"{%s}\"", code)

    const ast = parseScriptFragment(
        `{${code}}`,
        locationCalculator.getSubCalculatorAfter(-1),
        parserOptions
    ).ast
    const references = analyzeExternalReferences(ast, parserOptions)
    const block = ast.body[0] as ESLintBlockStatement
    const body = block.body
    const first = lodash.first(body)
    const last = lodash.last(body)
    const expression: VOnExpression = {
        type: "VOnExpression",
        range: [
            (first != null) ? first.range[0] : block.range[0] + 1,
            (last != null) ? last.range[1] : block.range[1] - 1,
        ],
        loc: {
            start: (first != null) ? first.loc.start : locationCalculator.getLocation(1),
            end: (last != null) ? last.loc.end : locationCalculator.getLocation(code.length + 1),
        },
        parent: DUMMY_PARENT,
        body,
    }
    const tokens = ast.tokens || []
    const comments = ast.comments || []

    // Modify parent.
    for (const b of body) {
        b.parent = expression
    }

    // Remvoe braces.
    tokens.shift()
    tokens.pop()

    // Remove $event: https://vuejs.org/v2/api/#v-on
    removeByName(references, "$event")

    return {expression, tokens, comments, references, variables: []}
}
