/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import first from "lodash/first"
import last from "lodash/last"
import sortedIndexBy from "lodash/sortedIndexBy"
import type {
    ESLintArrayExpression,
    ESLintArrayPattern,
    ESLintCallExpression,
    ESLintExpression,
    ESLintExpressionStatement,
    ESLintExtendedProgram,
    ESLintForInStatement,
    ESLintForOfStatement,
    ESLintFunctionExpression,
    ESLintIdentifier,
    ESLintUnaryExpression,
    ESLintVariableDeclaration,
    HasLocation,
    Node,
    Reference,
    Token,
    Variable,
    VElement,
    VFilter,
    VFilterSequenceExpression,
    VForExpression,
    VOnExpression,
    VSlotScopeExpression,
    OffsetRange,
    VGenericExpression,
} from "../ast/index"
import { ParseError } from "../ast/index"
import { debug } from "../common/debug"
import type {
    LocationCalculator,
    LocationCalculatorForHtml,
} from "../common/location-calculator"
import {
    analyzeExternalReferences,
    analyzeVariablesAndExternalReferences,
} from "./scope-analyzer"
import { getEcmaVersionIfUseEspree, getEspree } from "../common/espree"
import type { ParserOptions } from "../common/parser-options"
import {
    fixErrorLocation,
    fixLocation,
    fixLocations,
} from "../common/fix-locations"
import { DEFAULT_ECMA_VERSION } from "../script-setup/parser-options"
import type { LinesAndColumns } from "../common/lines-and-columns"
import type { ParserObject } from "../common/parser-object"
import { isEnhancedParserObject, isParserObject } from "../common/parser-object"
// eslint-disable-next-line node/no-extraneous-import -- ignore
import type { TSESTree } from "@typescript-eslint/utils"
import type { GenericProcessInfo } from "./generic"
import { extractGeneric } from "./generic"

// [1] = aliases.
// [2] = delimiter.
// [3] = iterator.
const ALIAS_ITERATOR = /^([\s\S]*?(?:\s|\)))(\bin\b|\bof\b)([\s\S]*)$/u
const PARENS = /^(\s*\()([\s\S]*?)(\)\s*)$/u
const DUMMY_PARENT: any = {}

// Like Vue, it judges whether it is a function expression or not.
// https://github.com/vuejs/core/blob/fef2acb2049fce3407dff17fe8af1836b97dfd73/packages/compiler-core/src/transforms/vOn.ts#L19
const IS_FUNCTION_EXPRESSION =
    /^\s*([\w$_]+|(async\s*)?\([^)]*?\))\s*(:[^=]+)?=>|^\s*(async\s+)?function(?:\s+[\w$]+)?\s*\(/u
//        ^^^^^^^ omit paren argument                                 ^^^^^^^^ function keyword
//                 ^^^^^ <--- async keyword (optional) ---> ^^^^^
//                           ^^------^^ arguments with parens                       ^^^^^^ named function (optional)
//                                         ^^^^^^^^^ return types (optional)
//                                                  ^^ arrow                                   ^^ opening paren

const IS_SIMPLE_PATH =
    /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\['[^']*?'\]|\["[^"]*?"\]|\[\d+\]|\[[A-Za-z_$][\w$]*\])*$/u

/**
 * Parse the alias and iterator of 'v-for' directive values.
 * @param code The code to parse.
 * @returns The parsed result.
 */
function processVForAliasAndIterator(code: string): {
    aliases: string
    hasParens: boolean
    delimiter: string
    iterator: string
    aliasesWithBrackets: string
} {
    const match = ALIAS_ITERATOR.exec(code)
    if (match != null) {
        const aliases = match[1]
        const parenMatch = PARENS.exec(aliases)
        return {
            aliases,
            hasParens: Boolean(parenMatch),
            aliasesWithBrackets: parenMatch
                ? `${parenMatch[1].slice(0, -1)}[${
                      parenMatch[2]
                  }]${parenMatch[3].slice(1)}`
                : `[${aliases.slice(0, -1)}]`,
            delimiter: match[2] || "",
            iterator: match[3],
        }
    }
    return {
        aliases: "",
        hasParens: false,
        aliasesWithBrackets: "",
        delimiter: "",
        iterator: code,
    }
}

/**
 * Get the comma token before a given node.
 * @param tokens The token list.
 * @param node The node to get the comma before this node.
 * @returns The comma token.
 */
function getCommaTokenBeforeNode(tokens: Token[], node: Node): Token | null {
    let tokenIndex = sortedIndexBy(
        tokens as { range: OffsetRange }[],
        { range: node.range },
        (t) => t.range[0],
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
    locationCalculator: LocationCalculatorForHtml,
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
    fixErrorLocation(err, locationCalculator)

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
    locationCalculator: LocationCalculatorForHtml,
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
 * @param locationCalculator The location calculator for fixLocations.
 * @param parserOptions The parser options.
 * @returns The result of parsing.
 */
export function parseScriptFragment(
    code: string,
    locationCalculator: LocationCalculator,
    parserOptions: ParserOptions,
): ESLintExtendedProgram {
    return parseScriptFragmentWithOption(
        code,
        locationCalculator,
        parserOptions,
    )
}

/**
 * Parse the given source code.
 *
 * @param code The source code to parse.
 * @param locationCalculator The location calculator for fixLocations.
 * @param parserOptions The parser options.
 * @param processOptions The process options.
 * @returns The result of parsing.
 */
function parseScriptFragmentWithOption(
    code: string,
    locationCalculator: LocationCalculator,
    parserOptions: ParserOptions,
    processOptions?: {
        preFixLocationProcess?: (result: ESLintExtendedProgram) => void
    },
): ESLintExtendedProgram {
    try {
        const result = parseScript(code, parserOptions)
        processOptions?.preFixLocationProcess?.(result)
        fixLocations(result, locationCalculator)
        return result
    } catch (err) {
        const perr = ParseError.normalize(err)
        if (perr) {
            fixErrorLocation(perr, locationCalculator)
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
    locationCalculator: LocationCalculatorForHtml,
    parserOptions: ParserOptions,
    allowEmpty = false,
): ExpressionParseResult<ESLintExpression> {
    debug('[script] parse expression: "0(%s)"', code)

    try {
        const result = parseScriptFragment(
            `0(${code})`,
            locationCalculator.getSubCalculatorShift(-2),
            parserOptions,
        )
        const { ast } = result
        const tokens = ast.tokens ?? []
        const comments = ast.comments ?? []
        const references = analyzeExternalReferences(result, parserOptions)
        const statement = ast.body[0] as ESLintExpressionStatement
        const callExpression = statement.expression as ESLintCallExpression
        const expression = callExpression.arguments[0]

        if (!allowEmpty && !expression) {
            return throwEmptyError(locationCalculator, "an expression")
        }
        if (expression?.type === "SpreadElement") {
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
    locationCalculator: LocationCalculatorForHtml,
    parserOptions: ParserOptions,
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
            const subCalculator = locationCalculator.getSubCalculatorShift(
                spaces.length,
            )
            const { ast } = parseScriptFragment(
                `"${calleeCode.trim()}"`,
                subCalculator,
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
                range: [
                    callee.range[0],
                    subCalculator.getOffsetWithGap(calleeCode.trim().length),
                ],
                loc: {
                    start: callee.loc.start,
                    end: subCalculator.getLocation(calleeCode.trim().length),
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
            const result = parseScriptFragment(
                `0${argsCode}`,
                locationCalculator
                    .getSubCalculatorAfter(paren)
                    .getSubCalculatorShift(-1),
                parserOptions,
            )
            const { ast } = result
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
            references.push(...analyzeExternalReferences(result, parserOptions))
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

function loadParser(parser: string) {
    if (parser !== "espree") {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require(parser)
    }
    return getEspree()
}

/**
 * Parse the given source code.
 *
 * @param code The source code to parse.
 * @param parserOptions The parser options.
 * @returns The result of parsing.
 */
export function parseScript(
    code: string,
    parserOptions: ParserOptions,
): ESLintExtendedProgram {
    const parser: ParserObject =
        typeof parserOptions.parser === "string"
            ? loadParser(parserOptions.parser)
            : isParserObject(parserOptions.parser)
              ? parserOptions.parser
              : getEspree()

    const result: any = isEnhancedParserObject(parser)
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
 * @param sfcCode The source code of SFC.
 * @param linesAndColumns The lines and columns location calculator.
 * @param parserOptions The parser options.
 * @returns The result of parsing.
 */
export function parseScriptElement(
    node: VElement,
    sfcCode: string,
    linesAndColumns: LinesAndColumns,
    originalParserOptions: ParserOptions,
): ESLintExtendedProgram {
    const parserOptions: ParserOptions = {
        ...originalParserOptions,
        ecmaVersion: originalParserOptions.ecmaVersion ?? DEFAULT_ECMA_VERSION,
    }

    let generic: GenericProcessInfo | null = null
    let code: string
    let offset: number
    const textNode = node.children[0]
    if (textNode?.type === "VText") {
        const [scriptStartOffset, scriptEndOffset] = textNode.range
        code = sfcCode.slice(scriptStartOffset, scriptEndOffset)
        offset = scriptStartOffset
        generic = extractGeneric(node)
        if (generic) {
            const defineTypesCode = `${generic.defineTypes
                .map((e) => e.define)
                .join(";")};\n`
            code = defineTypesCode + code
            offset -= defineTypesCode.length
        }
    } else {
        code = ""
        offset = node.startTag.range[1]
    }
    const locationCalculator =
        linesAndColumns.createOffsetLocationCalculator(offset)
    const result = parseScriptFragment(code, locationCalculator, parserOptions)
    if (generic) {
        generic.postprocess({
            result,
            isRemoveTarget(nodeOrToken) {
                return nodeOrToken.range[1] <= textNode.range[0]
            },
            getTypeDefScope(scopeManager) {
                return (
                    scopeManager.globalScope.childScopes.find(
                        (s) => s.type === "module",
                    ) ?? scopeManager.globalScope
                )
            },
        })
        const startToken = [
            result.ast.body[0],
            result.ast.tokens?.[0],
            result.ast.comments?.[0],
        ]
            .filter((e): e is NonNullable<typeof e> => Boolean(e))
            .sort((a, b) => a.range[0] - b.range[0])
            .find((t) => Boolean(t))

        // Restore Program node location
        if (startToken && result.ast.range[0] !== startToken.range[0]) {
            result.ast.range[0] = startToken.range[0]
            if (result.ast.start != null) {
                result.ast.start = startToken.start
            }
            result.ast.loc.start = { ...startToken.loc.start }
        }
    }
    // Needs the tokens of start/end tags for `lines-around-*` rules to work
    // correctly.
    if (result.ast.tokens != null) {
        const startTag = node.startTag
        const endTag = node.endTag

        result.ast.tokens.unshift({
            type: "Punctuator",
            range: startTag.range,
            loc: startTag.loc,
            value: "<script>",
        })
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
    locationCalculator: LocationCalculatorForHtml,
    parserOptions: ParserOptions,
    { allowEmpty = false, allowFilters = false } = {},
): ExpressionParseResult<ESLintExpression | VFilterSequenceExpression> {
    debug('[script] parse expression: "%s"', code)

    const [mainCode, ...filterCodes] =
        allowFilters && (parserOptions.vueFeatures?.filter ?? true)
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
    const ret =
        retB as unknown as ExpressionParseResult<VFilterSequenceExpression>

    ret.expression = {
        type: "VFilterSequenceExpression",
        parent: null as any,
        expression: retB.expression,
        filters: [],
        range: [...retB.expression.range] as const,
        loc: { ...retB.expression.loc },
    }
    ret.expression.expression.parent = ret.expression

    // Parse filters
    let prevLoc = mainCode.length
    for (const filterCode of filterCodes) {
        // Pipe token.
        ret.tokens.push(
            fixLocation(
                {
                    type: "Punctuator",
                    value: "|",
                    range: [prevLoc, prevLoc + 1],
                    loc: {} as any,
                },
                locationCalculator,
            ),
        )

        // Parse a filter
        const retF = parseFilter(
            filterCode,
            locationCalculator.getSubCalculatorShift(prevLoc + 1),
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
// eslint-disable-next-line complexity
export function parseVForExpression(
    code: string,
    locationCalculator: LocationCalculatorForHtml,
    parserOptions: ParserOptions,
): ExpressionParseResult<VForExpression> {
    if (code.trim() === "") {
        throwEmptyError(locationCalculator, "'<alias> in <expression>'")
    }

    if (isEcmaVersion5(parserOptions)) {
        return parseVForExpressionForEcmaVersion5(
            code,
            locationCalculator,
            parserOptions,
        )
    }
    const processed = processVForAliasAndIterator(code)

    if (!processed.aliases.trim()) {
        return throwEmptyError(locationCalculator, "an alias")
    }
    try {
        debug(
            '[script] parse v-for expression: "for(%s%s%s);"',
            processed.aliasesWithBrackets,
            processed.delimiter,
            processed.iterator,
        )

        const result = parseScriptFragment(
            `for(let ${processed.aliasesWithBrackets}${processed.delimiter}${processed.iterator});`,
            locationCalculator.getSubCalculatorShift(
                processed.hasParens ? -8 : -9,
            ),
            parserOptions,
        )
        const { ast } = result
        const tokens = ast.tokens ?? []
        const comments = ast.comments ?? []
        const scope = analyzeVariablesAndExternalReferences(
            result,
            "v-for",
            parserOptions,
        )
        const references = scope.references
        const variables = scope.variables
        const statement = ast.body[0] as
            | ESLintForInStatement
            | ESLintForOfStatement
        const varDecl = statement.left as ESLintVariableDeclaration
        const id = varDecl.declarations[0].id as ESLintArrayPattern
        const left = id.elements
        const right = statement.right

        if (!processed.hasParens && !left.length) {
            return throwEmptyError(locationCalculator, "an alias")
        }
        // Remove `for` `(` `let` `)` `;`.
        tokens.shift()
        tokens.shift()
        tokens.shift()
        tokens.pop()
        tokens.pop()

        const closeOffset = statement.left.range[1] - 1
        const closeIndex = tokens.findIndex((t) => t.range[0] === closeOffset)

        if (processed.hasParens) {
            // Restore parentheses from array brackets.
            const open = tokens[0]
            if (open != null) {
                open.value = "("
            }
            const close = tokens[closeIndex]
            if (close != null) {
                close.value = ")"
            }
        } else {
            // Remove array brackets.
            tokens.splice(closeIndex, 1)
            tokens.shift()
        }
        const firstToken = tokens[0] || statement.left
        const lastToken = tokens[tokens.length - 1] || statement.right
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

        return { expression, tokens, comments, references, variables }
    } catch (err) {
        return throwErrorAsAdjustingOutsideOfCode(err, code, locationCalculator)
    }
}

function isEcmaVersion5(parserOptions: ParserOptions) {
    const ecmaVersion = getEcmaVersionIfUseEspree(parserOptions)
    return ecmaVersion != null && ecmaVersion <= 5
}

function parseVForExpressionForEcmaVersion5(
    code: string,
    locationCalculator: LocationCalculatorForHtml,
    parserOptions: ParserOptions,
): ExpressionParseResult<VForExpression> {
    const processed = processVForAliasAndIterator(code)

    if (!processed.aliases.trim()) {
        return throwEmptyError(locationCalculator, "an alias")
    }
    try {
        const tokens: Token[] = []
        const comments: Token[] = []

        const parsedAliases = parseVForAliasesForEcmaVersion5(
            processed.aliasesWithBrackets,
            locationCalculator.getSubCalculatorShift(
                processed.hasParens ? 0 : -1,
            ),
            parserOptions,
        )

        if (processed.hasParens) {
            // Restore parentheses from array brackets.
            const open = parsedAliases.tokens[0]
            if (open != null) {
                open.value = "("
            }
            const close = last(parsedAliases.tokens)
            if (close != null) {
                close.value = ")"
            }
        } else {
            // Remove array brackets.
            parsedAliases.tokens.shift()
            parsedAliases.tokens.pop()
        }
        tokens.push(...parsedAliases.tokens)
        comments.push(...parsedAliases.comments)
        const { left, variables } = parsedAliases

        if (!processed.hasParens && !left.length) {
            return throwEmptyError(locationCalculator, "an alias")
        }

        const delimiterStart = processed.aliases.length
        const delimiterEnd = delimiterStart + processed.delimiter.length
        tokens.push(
            fixLocation(
                {
                    type:
                        processed.delimiter === "in" ? "Keyword" : "Identifier",
                    value: processed.delimiter,
                    start: delimiterStart,
                    end: delimiterEnd,
                    loc: {} as any,
                    range: [delimiterStart, delimiterEnd],
                } as Token,
                locationCalculator,
            ),
        )

        const parsedIterator = parseVForIteratorForEcmaVersion5(
            processed.iterator,
            locationCalculator.getSubCalculatorShift(delimiterEnd),
            parserOptions,
        )

        tokens.push(...parsedIterator.tokens)
        comments.push(...parsedIterator.comments)
        const { right, references } = parsedIterator
        const firstToken = tokens[0]
        const lastToken = last(tokens) || firstToken
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

        return { expression, tokens, comments, references, variables }
    } catch (err) {
        return throwErrorAsAdjustingOutsideOfCode(err, code, locationCalculator)
    }
}

function parseVForAliasesForEcmaVersion5(
    code: string,
    locationCalculator: LocationCalculatorForHtml,
    parserOptions: ParserOptions,
) {
    const result = parseScriptFragment(
        `0(${code})`,
        locationCalculator.getSubCalculatorShift(-2),
        parserOptions,
    )
    const { ast } = result
    const tokens = ast.tokens ?? []
    const comments = ast.comments ?? []
    const variables = analyzeExternalReferences(result, parserOptions).map(
        transformVariable,
    )

    const statement = ast.body[0] as ESLintExpressionStatement
    const callExpression = statement.expression as ESLintCallExpression
    const expression = callExpression.arguments[0] as ESLintArrayExpression

    const left: ESLintIdentifier[] = expression.elements.filter(
        (e): e is ESLintIdentifier => {
            if (e == null || e.type === "Identifier") {
                return true
            }
            const errorToken = tokens.find(
                (t) => e.range[0] <= t.range[0] && t.range[1] <= e.range[1],
            )!
            return throwUnexpectedTokenError(errorToken.value, errorToken)
        },
    )
    // Remove parens.
    tokens.shift()
    tokens.shift()
    tokens.pop()

    return { left, tokens, comments, variables }

    function transformVariable(reference: Reference): Variable {
        const ret: Variable = {
            id: reference.id,
            kind: "v-for",
            references: [],
        }
        Object.defineProperty(ret, "references", { enumerable: false })

        return ret
    }
}

function parseVForIteratorForEcmaVersion5(
    code: string,
    locationCalculator: LocationCalculatorForHtml,
    parserOptions: ParserOptions,
) {
    const result = parseScriptFragment(
        `0(${code})`,
        locationCalculator.getSubCalculatorShift(-2),
        parserOptions,
    )
    const { ast } = result
    const tokens = ast.tokens ?? []
    const comments = ast.comments ?? []
    const references = analyzeExternalReferences(result, parserOptions)

    const statement = ast.body[0] as ESLintExpressionStatement
    const callExpression = statement.expression as ESLintCallExpression
    const expression = callExpression.arguments[0]

    if (!expression) {
        return throwEmptyError(locationCalculator, "an expression")
    }
    if (expression?.type === "SpreadElement") {
        return throwUnexpectedTokenError("...", expression)
    }
    const right = expression

    // Remove parens.
    tokens.shift()
    tokens.shift()
    tokens.pop()
    return { right, tokens, comments, references }
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
    locationCalculator: LocationCalculatorForHtml,
    parserOptions: ParserOptions,
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
    locationCalculator: LocationCalculatorForHtml,
    parserOptions: ParserOptions,
): ExpressionParseResult<VOnExpression> {
    debug('[script] parse v-on expression: "void function($event){%s}"', code)

    if (code.trim() === "") {
        throwEmptyError(locationCalculator, "statements")
    }

    try {
        const result = parseScriptFragment(
            `void function($event){${code}}`,
            locationCalculator.getSubCalculatorShift(-22),
            parserOptions,
        )
        const { ast } = result
        const references = analyzeExternalReferences(result, parserOptions)
        const outermostStatement = ast.body[0] as ESLintExpressionStatement
        const functionDecl = (
            outermostStatement.expression as ESLintUnaryExpression
        ).argument as ESLintFunctionExpression
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
        const tokens = ast.tokens ?? []
        const comments = ast.comments ?? []

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
    locationCalculator: LocationCalculatorForHtml,
    parserOptions: ParserOptions,
): ExpressionParseResult<VSlotScopeExpression> {
    debug('[script] parse slot-scope expression: "void function(%s) {}"', code)

    if (code.trim() === "") {
        throwEmptyError(
            locationCalculator,
            "an identifier or an array/object pattern",
        )
    }

    try {
        const result = parseScriptFragment(
            `void function(${code}) {}`,
            locationCalculator.getSubCalculatorShift(-14),
            parserOptions,
        )
        const { ast } = result
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

        const tokens = ast.tokens ?? []
        const comments = ast.comments ?? []
        const scope = analyzeVariablesAndExternalReferences(
            result,
            "scope",
            parserOptions,
        )
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

        // Remove `void` `function` `(` `)` `{` `}`.
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

/**
 * Parse the source code of `generic` directive.
 * @param code The source code of `generic` directive.
 * @param locationCalculator The location calculator for the inline script.
 * @param parserOptions The parser options.
 * @returns The result of parsing.
 */
export function parseGenericExpression(
    code: string,
    locationCalculator: LocationCalculatorForHtml,
    parserOptions: ParserOptions,
): ExpressionParseResult<VGenericExpression> {
    debug('[script] parse generic definition: "void function<%s>() {}"', code)

    if (code.trim() === "") {
        throwEmptyError(locationCalculator, "a type parameter")
    }

    function getParams(result: ESLintExtendedProgram) {
        const { ast } = result
        const statement = ast.body[0] as ESLintExpressionStatement
        const rawExpression = statement.expression as ESLintUnaryExpression
        const classDecl = rawExpression.argument as ESLintFunctionExpression
        const typeParameters = (classDecl as TSESTree.FunctionExpression)
            .typeParameters
        return typeParameters?.params
    }

    try {
        const rawParams: string[] = []
        const scriptLet = `void function<${code}>(){}`
        const result = parseScriptFragmentWithOption(
            scriptLet,
            locationCalculator.getSubCalculatorShift(-14),
            { ...parserOptions, project: undefined, projectService: undefined },
            {
                preFixLocationProcess(preResult) {
                    const params = getParams(preResult)
                    if (params) {
                        for (const param of params) {
                            rawParams.push(
                                scriptLet.slice(param.range[0], param.range[1]),
                            )
                        }
                    }
                },
            },
        )
        const { ast } = result
        const params = getParams(result)

        if (!params || params.length === 0) {
            return {
                expression: null,
                tokens: [],
                comments: [],
                references: [],
                variables: [],
            }
        }

        const tokens = ast.tokens ?? []
        const comments = ast.comments ?? []
        const scope = analyzeVariablesAndExternalReferences(
            result,
            "generic",
            parserOptions,
        )
        const references = scope.references
        const variables = scope.variables
        const firstParam = first(params)!
        const lastParam = last(params)!
        const expression: VGenericExpression = {
            type: "VGenericExpression",
            range: [firstParam.range[0], lastParam.range[1]],
            loc: { start: firstParam.loc.start, end: lastParam.loc.end },
            parent: DUMMY_PARENT,
            params,
            rawParams,
        }

        // Modify parent.
        for (const param of params) {
            ;(param as any).parent = expression
        }

        // Remove `void` `function` `<` `>` `(` `)` `{` `}`.
        tokens.shift()
        tokens.shift()
        tokens.shift()
        tokens.pop()
        tokens.pop()
        tokens.pop()
        tokens.pop()
        tokens.pop()

        return { expression, tokens, comments, references, variables }
    } catch (err) {
        return throwErrorAsAdjustingOutsideOfCode(err, code, locationCalculator)
    }
}
