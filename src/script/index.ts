/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import {traverseNodes, ESLintArrayPattern, ESLintExpression, ESLintExpressionStatement, ESLintExtendedProgram, ESLintForInStatement, ESLintForOfStatement, ESLintPattern, ESLintProgram, ESLintVariableDeclaration, Node, ParseError, Reference, Token, Variable, VElement, VExpressionContainer, VForExpression} from "../ast"
import {debug} from "../common/debug"
import {LocationCalculator} from "../common/location-calculator"
import {analyzeExternalReferences, analyzeVariablesAndExternalReferences} from "./scope-analyzer"

// [1] = spacing before the aliases.
// [2] = aliases.
// [3] = all after the aliases.
const ALIAS_PARENS = /^(\s*)\(([\s\S]+)\)(\s*(?:in|of)\b[\s\S]+)$/

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
        throw new ParseError(
            "Unexpected pattern",
            undefined,
            left.range[0],
            left.loc.start.line,
            left.loc.start.column
        )
    }
    const id = left.declarations[0].id

    if (replaced) {
        return (id as ESLintArrayPattern).elements
    }
    return [id]
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
    expression: ESLintExpression | VForExpression
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
                raw: "<script>",
            })
        }
        if (endTag != null) {
            result.ast.tokens.push({
                type: "Punctuator",
                range: endTag.range,
                loc: endTag.loc,
                value: "</script>",
                raw: "</script>",
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
        parent: {} as VExpressionContainer,
        left,
        right,
    }

    // Remvoe `for` `(` `let` `)` `;`.
    tokens.shift()
    tokens.shift()
    tokens.shift()
    tokens.pop()
    tokens.pop()

    // Restore parentheses from array brackets.
    if (replaced) {
        const open = statement.left.range[0]
        const close = statement.left.range[1] - 1

        for (const token of tokens) {
            if (token.range[0] === open) {
                token.value = "("
            }
            else if (token.range[0] === close) {
                token.value = ")"
                break
            }
        }
    }

    return {expression, tokens, comments, references, variables}
}
