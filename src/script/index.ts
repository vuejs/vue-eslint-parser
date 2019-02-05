/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import first from "lodash/first"
import last from "lodash/last"
import sortedIndexBy from "lodash/sortedIndexBy"
import {
    traverseNodes,
    ESLintArrayPattern,
    ESLintCallExpression,
    ESLintExpression,
    ESLintExpressionStatement,
    ESLintExtendedProgram,
    ESLintForInStatement,
    ESLintForOfStatement,
    ESLintFunctionExpression,
    ESLintPattern,
    ESLintProgram,
    ESLintVariableDeclaration,
    ESLintUnaryExpression,
    HasLocation,
    Node,
    ParseError,
    Reference,
    Token,
    Variable,
    VElement,
    VFilter,
    VFilterSequenceExpression,
    VForExpression,
    VOnExpression,
    VSlotScopeExpression,
} from "../ast"
import { debug } from "../common/debug"
import { LocationCalculator } from "../common/location-calculator"
import {
    analyzeExternalReferences,
    analyzeVariablesAndExternalReferences,
} from "./scope-analyzer"

// [1] = spacing before the aliases.
// [2] = aliases.
// [3] = all after the aliases.
const ALIAS_PARENS = /^(\s*)\(([\s\S]+)\)(\s*(?:in|of)\b[\s\S]+)$/u
const DUMMY_PARENT: any = {}

// Like Vue, it judges whether it is a function expression or not.
// https://github.com/vuejs/vue/blob/0948d999f2fddf9f90991956493f976273c5da1f/src/compiler/codegen/events.js#L3
const IS_FUNCTION_EXPRESSION = /^\s*([\w$_]+|\([^)]*?\))\s*=>|^function\s*\(/u
const IS_SIMPLE_PATH = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\['[^']*?'\]|\["[^"]*?"\]|\[\d+\]|\[[A-Za-z_$][\w$]*\])*$/u

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
 * @param result The parsing result to modify.
 * @param locationCalculator The location calculator to modify.
 */
function postprocess(
    result: ESLintExtendedProgram,
    locationCalculator: LocationCalculator,
): void {
    // There are cases which the same node instance appears twice in the tree.
    // E.g. `let {a} = {}` // This `a` appears twice at `Property#key` and `Property#value`.
    const traversed = new Set<Node | number[]>()

    traverseNodes(result.ast, {
        visitorKeys: result.visitorKeys,

        enterNode(node, parent) {
            if (!traversed.has(node)) {
                traversed.add(node)
                node.parent = parent

                // `babel-eslint@8` has shared `Node#range` with multiple nodes.
                // See also: https://github.com/vuejs/eslint-plugin-vue/issues/208
                if (!traversed.has(node.range)) {
                    traversed.add(node.range)
                    locationCalculator.fixLocation(node)
                }
            }
        },

        leaveNode() {
            // Do nothing.
        },
    })

    for (const token of result.ast.tokens || []) {
        locationCalculator.fixLocation(token)
    }
    for (const comment of result.ast.comments || []) {
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
function normalizeLeft(
    left: ESLintVariableDeclaration | ESLintPattern,
    replaced: boolean,
): ESLintPattern[] {
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
 * Get the comma token before a given node.
 * @param tokens The token list.
 * @param node The node to get the comma before this node.
 * @returns The comma token.
 */
function getCommaTokenBeforeNode(tokens: Token[], node: Node): Token | null {
    let tokenIndex = sortedIndexBy(
        tokens,
        { range: node.range },
        t => t.range[0],
    )

    while (tokenIndex >= 0) {
        const token = tokens[tokenIndex]
        if (token.type === "Punctuator" && token.value === ",") {
            return token
        }
        tokenIndex -= 1
    }

    return null
}

/**
 * Throw syntax error for empty.
 * @param locationCalculator The location calculator to get line/column.
 */
function throwEmptyError(
    locationCalculator: LocationCalculator,
    expected: string,
): never {
    const loc = locationCalculator.getLocation(0)
    const err = new ParseError(
        `Expected to be ${expected}, but got empty.`,
        undefined,
        0,
        loc.line,
        loc.column,
    )
    locationCalculator.fixErrorLocation(err)

    throw err
}

/**
 * Throw syntax error for unexpected token.
 * @param locationCalculator The location calculator to get line/column.
 * @param name The token name.
 * @param token The token object to get that location.
 */
function throwUnexpectedTokenError(name: string, token: HasLocation): never {
    const err = new ParseError(
        `Unexpected token '${name}'.`,
        undefined,
        token.range[0],
        token.loc.start.line,
        token.loc.start.column,
    )

    throw err
}

/**
 * Throw syntax error of outside of code.
 * @param locationCalculator The location calculator to get line/column.
 */
function throwErrorAsAdjustingOutsideOfCode(
    err: any,
    code: string,
    locationCalculator: LocationCalculator,
): never {
    if (ParseError.isParseError(err)) {
        const endOffset = locationCalculator.getOffsetWithGap(code.length)
        if (err.index >= endOffset) {
            err.message = "Unexpected end of expression."
        }
    }

    throw err
}

/**
 * Parse the given source code.
 *
 * @param code The source code to parse.
 * @param locationCalculator The location calculator for postprocess.
 * @param parserOptions The parser options.
 * @returns The result of parsing.
 */
function parseScriptFragment(
    code: string,
    locationCalculator: LocationCalculator,
    parserOptions: any,
): ESLintExtendedProgram {
    try {
        const result = parseScript(code, parserOptions)
        postprocess(result, locationCalculator)
        return result
    } catch (err) {
        const perr = ParseError.normalize(err)
        if (perr) {
            locationCalculator.fixErrorLocation(perr)
            throw perr
        }
        throw err
    }
}

const validDivisionCharRE = /[\w).+\-_$\]]/u

/**
 * This is a fork of https://github.com/vuejs/vue/blob/2686818beb5728e3b7aa22f47a3b3f0d39d90c8e/src/compiler/parser/filter-parser.js
 * @param exp the expression to process filters.
 */
//eslint-disable-next-line complexity
function splitFilters(exp: string): string[] {
    const result: string[] = []
    let inSingle = false
    let inDouble = false
    let inTemplateString = false
    let inRegex = false
    let curly = 0
    let square = 0
    let paren = 0
    let lastFilterIndex = 0
    let c = 0
    let prev = 0

    for (let i = 0; i < exp.length; i++) {
        prev = c
        c = exp.charCodeAt(i)
        if (inSingle) {
            if (c === 0x27 && prev !== 0x5c) {
                inSingle = false
            }
        } else if (inDouble) {
            if (c === 0x22 && prev !== 0x5c) {
                inDouble = false
            }
        } else if (inTemplateString) {
            if (c === 0x60 && prev !== 0x5c) {
                inTemplateString = false
            }
        } else if (inRegex) {
            if (c === 0x2f && prev !== 0x5c) {
                inRegex = false
            }
        } else if (
            c === 0x7c && // pipe
            exp.charCodeAt(i + 1) !== 0x7c &&
            exp.charCodeAt(i - 1) !== 0x7c &&
            !curly &&
            !square &&
            !paren
        ) {
            result.push(exp.slice(lastFilterIndex, i))
            lastFilterIndex = i + 1
        } else {
            switch (c) {
                case 0x22: // "
                    inDouble = true
                    break
                case 0x27: // '
                    inSingle = true
                    break
                case 0x60: // `
                    inTemplateString = true
                    break
                case 0x28: // (
                    paren++
                    break
                case 0x29: // )
                    paren--
                    break
                case 0x5b: // [
                    square++
                    break
                case 0x5d: // ]
                    square--
                    break
                case 0x7b: // {
                    curly++
                    break
                case 0x7d: // }
                    curly--
                    break
                // no default
            }
            if (c === 0x2f) {
                // /
                let j = i - 1
                let p
                // find first non-whitespace prev char
                for (; j >= 0; j--) {
                    p = exp.charAt(j)
                    if (p !== " ") {
                        break
                    }
                }
                if (!p || !validDivisionCharRE.test(p)) {
                    inRegex = true
                }
            }
        }
    }

    result.push(exp.slice(lastFilterIndex))

    return result
}

/**
 * Parse the source code of inline scripts.
 * @param code The source code of inline scripts.
 * @param locationCalculator The location calculator for the inline script.
 * @param parserOptions The parser options.
 * @returns The result of parsing.
 */
function parseExpressionBody(
    code: string,
    locationCalculator: LocationCalculator,
    parserOptions: any,
    allowEmpty = false,
): ExpressionParseResult<ESLintExpression> {
    debug('[script] parse expression: "0(%s)"', code)

    try {
        const ast = parseScriptFragment(
            `0(${code})`,
            locationCalculator.getSubCalculatorAfter(-2),
            parserOptions,
        ).ast
        const tokens = ast.tokens || []
        const comments = ast.comments || []
        const references = analyzeExternalReferences(ast, parserOptions)
        const statement = ast.body[0] as ESLintExpressionStatement
        const callExpression = statement.expression as ESLintCallExpression
        const expression = callExpression.arguments[0]

        if (!allowEmpty && !expression) {
            return throwEmptyError(locationCalculator, "an expression")
        }
        if (expression && expression.type === "SpreadElement") {
            return throwUnexpectedTokenError("...", expression)
        }
        if (callExpression.arguments[1]) {
            const node = callExpression.arguments[1]
            return throwUnexpectedTokenError(
                ",",
                getCommaTokenBeforeNode(tokens, node) || node,
            )
        }

        // Remove parens.
        tokens.shift()
        tokens.shift()
        tokens.pop()

        return { expression, tokens, comments, references, variables: [] }
    } catch (err) {
        return throwErrorAsAdjustingOutsideOfCode(err, code, locationCalculator)
    }
}

/**
 * Parse the source code of inline scripts.
 * @param code The source code of inline scripts.
 * @param locationCalculator The location calculator for the inline script.
 * @param parserOptions The parser options.
 * @returns The result of parsing.
 */
function parseFilter(
    code: string,
    locationCalculator: LocationCalculator,
    parserOptions: any,
): ExpressionParseResult<VFilter> | null {
    debug('[script] parse filter: "%s"', code)

    try {
        const expression: VFilter = {
            type: "VFilter",
            parent: null as any,
            range: [0, 0],
            loc: {} as any,
            callee: null as any,
            arguments: [],
        }
        const tokens: Token[] = []
        const comments: Token[] = []
        const references: Reference[] = []

        // Parse the callee.
        const paren = code.indexOf("(")
        const calleeCode = paren === -1 ? code : code.slice(0, paren)
        const argsCode = paren === -1 ? null : code.slice(paren)

        // Parse the callee.
        if (calleeCode.trim()) {
            const spaces = /^\s*/u.exec(calleeCode)![0]
            const { ast } = parseScriptFragment(
                `${spaces}"${calleeCode.trim()}"`,
                locationCalculator,
                parserOptions,
            )
            const statement = ast.body[0] as ESLintExpressionStatement
            const callee = statement.expression
            if (callee.type !== "Literal") {
                const { loc, range } = ast.tokens![0]
                return throwUnexpectedTokenError('"', {
                    range: [range[1] - 1, range[1]],
                    loc: {
                        start: {
                            line: loc.end.line,
                            column: loc.end.column - 1,
                        },
                        end: loc.end,
                    },
                })
            }

            expression.callee = {
                type: "Identifier",
                parent: expression,
                range: [callee.range[0], callee.range[1] - 2],
                loc: {
                    start: callee.loc.start,
                    end: locationCalculator.getLocation(
                        callee.range[1] - callee.range[0] - 1,
                    ),
                },
                name: String(callee.value),
            }
            tokens.push({
                type: "Identifier",
                value: calleeCode.trim(),
                range: expression.callee.range,
                loc: expression.callee.loc,
            })
        } else {
            return throwEmptyError(locationCalculator, "a filter name")
        }

        // Parse the arguments.
        if (argsCode != null) {
            const { ast } = parseScriptFragment(
                `0${argsCode}`,
                locationCalculator.getSubCalculatorAfter(paren - 1),
                parserOptions,
            )
            const statement = ast.body[0] as ESLintExpressionStatement
            const callExpression = statement.expression

            ast.tokens!.shift()

            if (
                callExpression.type !== "CallExpression" ||
                callExpression.callee.type !== "Literal"
            ) {
                // Report the next token of `)`.
                let nestCount = 1
                for (const token of ast.tokens!.slice(1)) {
                    if (nestCount === 0) {
                        return throwUnexpectedTokenError(token.value, token)
                    }
                    if (token.type === "Punctuator" && token.value === "(") {
                        nestCount += 1
                    }
                    if (token.type === "Punctuator" && token.value === ")") {
                        nestCount -= 1
                    }
                }

                const token = last(ast.tokens)!
                return throwUnexpectedTokenError(token.value, token)
            }

            for (const argument of callExpression.arguments) {
                argument.parent = expression
                expression.arguments.push(argument)
            }
            tokens.push(...ast.tokens!)
            comments.push(...ast.comments!)
            references.push(...analyzeExternalReferences(ast, parserOptions))
        }

        // Update range.
        const firstToken = tokens[0]
        const lastToken = last(tokens)!
        expression.range = [firstToken.range[0], lastToken.range[1]]
        expression.loc = { start: firstToken.loc.start, end: lastToken.loc.end }

        return { expression, tokens, comments, references, variables: [] }
    } catch (err) {
        return throwErrorAsAdjustingOutsideOfCode(err, code, locationCalculator)
    }
}

/**
 * The result of parsing expressions.
 */
export interface ExpressionParseResult<T extends Node> {
    expression: T | null
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
export function parseScript(
    code: string,
    parserOptions: any,
): ESLintExtendedProgram {
    const parser: ESLintCustomParser =
        typeof parserOptions.parser === "string"
            ? require(parserOptions.parser)
            : require("espree")
    const result: any =
        typeof parser.parseForESLint === "function"
            ? parser.parseForESLint(code, parserOptions)
            : parser.parse(code, parserOptions)

    if (result.ast != null) {
        return result
    }
    return { ast: result }
}

/**
 * Parse the source code of the given `<script>` element.
 * @param node The `<script>` element to parse.
 * @param globalLocationCalculator The location calculator for postprocess.
 * @param parserOptions The parser options.
 * @returns The result of parsing.
 */
export function parseScriptElement(
    node: VElement,
    globalLocationCalculator: LocationCalculator,
    parserOptions: any,
): ESLintExtendedProgram {
    const text = node.children[0]
    const offset =
        text != null && text.type === "VText"
            ? text.range[0]
            : node.startTag.range[1]
    const code = text != null && text.type === "VText" ? text.value : ""
    const locationCalculator = globalLocationCalculator.getSubCalculatorAfter(
        offset,
    )
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
export function parseExpression(
    code: string,
    locationCalculator: LocationCalculator,
    parserOptions: any,
    { allowEmpty = false, allowFilters = false } = {},
): ExpressionParseResult<ESLintExpression | VFilterSequenceExpression> {
    debug('[script] parse expression: "%s"', code)

    const [mainCode, ...filterCodes] = allowFilters
        ? splitFilters(code)
        : [code]
    if (filterCodes.length === 0) {
        return parseExpressionBody(
            code,
            locationCalculator,
            parserOptions,
            allowEmpty,
        )
    }

    // Parse expression
    const retB = parseExpressionBody(
        mainCode,
        locationCalculator,
        parserOptions,
    )
    if (!retB.expression) {
        return retB
    }
    const ret = (retB as unknown) as ExpressionParseResult<
        VFilterSequenceExpression
    >

    ret.expression = {
        type: "VFilterSequenceExpression",
        parent: null as any,
        expression: retB.expression,
        filters: [],
        range: retB.expression.range.slice(0) as [number, number],
        loc: Object.assign({}, retB.expression.loc),
    }
    ret.expression.expression.parent = ret.expression

    // Parse filters
    let prevLoc = mainCode.length
    for (const filterCode of filterCodes) {
        // Pipe token.
        ret.tokens.push(
            locationCalculator.fixLocation({
                type: "Punctuator",
                value: "|",
                range: [prevLoc, prevLoc + 1],
                loc: {} as any,
            }),
        )

        // Parse a filter
        const retF = parseFilter(
            filterCode,
            locationCalculator.getSubCalculatorAfter(prevLoc + 1),
            parserOptions,
        )
        if (retF) {
            if (retF.expression) {
                ret.expression.filters.push(retF.expression)
                retF.expression.parent = ret.expression
            }
            ret.tokens.push(...retF.tokens)
            ret.comments.push(...retF.comments)
            ret.references.push(...retF.references)
        }

        prevLoc += 1 + filterCode.length
    }

    // Update range.
    const lastToken = last(ret.tokens)!
    ret.expression.range[1] = lastToken.range[1]
    ret.expression.loc.end = lastToken.loc.end

    return ret
}

/**
 * Parse the source code of inline scripts.
 * @param code The source code of inline scripts.
 * @param locationCalculator The location calculator for the inline script.
 * @param parserOptions The parser options.
 * @returns The result of parsing.
 */
export function parseVForExpression(
    code: string,
    locationCalculator: LocationCalculator,
    parserOptions: any,
): ExpressionParseResult<VForExpression> {
    const processedCode = replaceAliasParens(code)
    debug('[script] parse v-for expression: "for(%s);"', processedCode)

    if (code.trim() === "") {
        throwEmptyError(locationCalculator, "'<alias> in <expression>'")
    }

    try {
        const replaced = processedCode !== code
        const ast = parseScriptFragment(
            `for(let ${processedCode});`,
            locationCalculator.getSubCalculatorAfter(-8),
            parserOptions,
        ).ast
        const tokens = ast.tokens || []
        const comments = ast.comments || []
        const scope = analyzeVariablesAndExternalReferences(ast, parserOptions)
        const references = scope.references
        const variables = scope.variables
        const statement = ast.body[0] as
            | ESLintForInStatement
            | ESLintForOfStatement
        const left = normalizeLeft(statement.left, replaced)
        const right = statement.right
        const firstToken = tokens[3] || statement.left
        const lastToken = tokens[tokens.length - 3] || statement.right
        const expression: VForExpression = {
            type: "VForExpression",
            range: [firstToken.range[0], lastToken.range[1]],
            loc: { start: firstToken.loc.start, end: lastToken.loc.end },
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

        return { expression, tokens, comments, references, variables }
    } catch (err) {
        return throwErrorAsAdjustingOutsideOfCode(err, code, locationCalculator)
    }
}

/**
 * Parse the source code of inline scripts.
 * @param code The source code of inline scripts.
 * @param locationCalculator The location calculator for the inline script.
 * @param parserOptions The parser options.
 * @returns The result of parsing.
 */
export function parseVOnExpression(
    code: string,
    locationCalculator: LocationCalculator,
    parserOptions: any,
): ExpressionParseResult<ESLintExpression | VOnExpression> {
    if (IS_FUNCTION_EXPRESSION.test(code) || IS_SIMPLE_PATH.test(code)) {
        return parseExpressionBody(code, locationCalculator, parserOptions)
    }
    return parseVOnExpressionBody(code, locationCalculator, parserOptions)
}

/**
 * Parse the source code of inline scripts.
 * @param code The source code of inline scripts.
 * @param locationCalculator The location calculator for the inline script.
 * @param parserOptions The parser options.
 * @returns The result of parsing.
 */
function parseVOnExpressionBody(
    code: string,
    locationCalculator: LocationCalculator,
    parserOptions: any,
): ExpressionParseResult<VOnExpression> {
    debug('[script] parse v-on expression: "void function($event){%s}"', code)

    if (code.trim() === "") {
        throwEmptyError(locationCalculator, "statements")
    }

    try {
        const ast = parseScriptFragment(
            `void function($event){${code}}`,
            locationCalculator.getSubCalculatorAfter(-22),
            parserOptions,
        ).ast
        const references = analyzeExternalReferences(ast, parserOptions)
        const outermostStatement = ast.body[0] as ESLintExpressionStatement
        const functionDecl = (outermostStatement.expression as ESLintUnaryExpression)
            .argument as ESLintFunctionExpression
        const block = functionDecl.body
        const body = block.body
        const firstStatement = first(body)
        const lastStatement = last(body)
        const expression: VOnExpression = {
            type: "VOnExpression",
            range: [
                firstStatement != null
                    ? firstStatement.range[0]
                    : block.range[0] + 1,
                lastStatement != null
                    ? lastStatement.range[1]
                    : block.range[1] - 1,
            ],
            loc: {
                start:
                    firstStatement != null
                        ? firstStatement.loc.start
                        : locationCalculator.getLocation(1),
                end:
                    lastStatement != null
                        ? lastStatement.loc.end
                        : locationCalculator.getLocation(code.length + 1),
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

        // Remove braces.
        tokens.splice(0, 6)
        tokens.pop()

        return { expression, tokens, comments, references, variables: [] }
    } catch (err) {
        return throwErrorAsAdjustingOutsideOfCode(err, code, locationCalculator)
    }
}

/**
 * Parse the source code of `slot-scope` directive.
 * @param code The source code of `slot-scope` directive.
 * @param locationCalculator The location calculator for the inline script.
 * @param parserOptions The parser options.
 * @returns The result of parsing.
 */
export function parseSlotScopeExpression(
    code: string,
    locationCalculator: LocationCalculator,
    parserOptions: any,
): ExpressionParseResult<VSlotScopeExpression> {
    debug('[script] parse slot-scope expression: "void function(%s) {}"', code)

    if (code.trim() === "") {
        throwEmptyError(
            locationCalculator,
            "an identifier or an array/object pattern",
        )
    }

    try {
        const ast = parseScriptFragment(
            `void function(${code}) {}`,
            locationCalculator.getSubCalculatorAfter(-14),
            parserOptions,
        ).ast
        const statement = ast.body[0] as ESLintExpressionStatement
        const rawExpression = statement.expression as ESLintUnaryExpression
        const functionDecl = rawExpression.argument as ESLintFunctionExpression
        const params = functionDecl.params

        if (params.length === 0) {
            return {
                expression: null,
                tokens: [],
                comments: [],
                references: [],
                variables: [],
            }
        }

        const tokens = ast.tokens || []
        const comments = ast.comments || []
        const scope = analyzeVariablesAndExternalReferences(ast, parserOptions)
        const references = scope.references
        const variables = scope.variables
        const firstParam = first(params)!
        const lastParam = last(params)!
        const expression: VSlotScopeExpression = {
            type: "VSlotScopeExpression",
            range: [firstParam.range[0], lastParam.range[1]],
            loc: { start: firstParam.loc.start, end: lastParam.loc.end },
            parent: DUMMY_PARENT,
            params: functionDecl.params,
        }

        // Modify parent.
        for (const param of params) {
            param.parent = expression
        }

        // Remvoe `void` `function` `(` `)` `{` `}`.
        tokens.shift()
        tokens.shift()
        tokens.shift()
        tokens.pop()
        tokens.pop()
        tokens.pop()

        return { expression, tokens, comments, references, variables }
    } catch (err) {
        return throwErrorAsAdjustingOutsideOfCode(err, code, locationCalculator)
    }
}
