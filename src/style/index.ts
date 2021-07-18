import type {
    OffsetRange,
    Token,
    VDocumentFragment,
    VElement,
    VExpressionContainer,
    VStyleElement,
    VText,
} from "../ast"
import { ParseError } from "../ast"
import { getLang, getOwnerDocument } from "../common/ast-utils"
import { debug } from "../common/debug"
import { insertError } from "../common/error-utils"
import type { LocationCalculatorForHtml } from "../common/location-calculator"
import type { ParserOptions } from "../common/parser-options"
import {
    createSimpleToken,
    insertComments,
    replaceAndSplitTokens,
} from "../common/token-utils"
import { parseExpression } from "../script"
import { DEFAULT_ECMA_VERSION } from "../script-setup/parser-options"
import { resolveReferences } from "../template"

type CSSParseOption = { inlineComment?: boolean }

/**
 * Parse the source code of the given `<style>` elements.
 * @param elements The `<style>` elements to parse.
 * @param globalLocationCalculator The location calculator for fixLocations.
 * @param parserOptions The parser options.
 * @returns The result of parsing.
 */
export function parseStyleElements(
    elements: VElement[],
    globalLocationCalculator: LocationCalculatorForHtml,
    originalParserOptions: ParserOptions,
): void {
    const parserOptions: ParserOptions = {
        ...originalParserOptions,
        ecmaVersion: originalParserOptions.ecmaVersion || DEFAULT_ECMA_VERSION,
    }

    for (const style of elements) {
        ;(style as VStyleElement).style = true
        parseStyleElement(
            style as VStyleElement,
            globalLocationCalculator,
            parserOptions,
            {
                inlineComment: (getLang(style) || "css") !== "css",
            },
        )
    }
}

function parseStyleElement(
    style: VStyleElement,
    globalLocationCalculator: LocationCalculatorForHtml,
    parserOptions: ParserOptions,
    cssOptions: CSSParseOption,
) {
    if (style.children.length !== 1) {
        return
    }
    const textNode = style.children[0]
    if (textNode.type !== "VText") {
        return
    }
    const code = textNode.value
    // short circuit
    if (!code.includes("v-bind(")) {
        return
    }

    const locationCalculator = globalLocationCalculator.getSubCalculatorAfter(
        textNode.range[0],
    )
    const document = getOwnerDocument(style)
    parseStyle(
        document,
        style,
        code,
        locationCalculator,
        parserOptions,
        cssOptions,
    )
}

function parseStyle(
    document: VDocumentFragment | null,
    style: VStyleElement,
    code: string,
    locationCalculator: LocationCalculatorForHtml,
    parserOptions: ParserOptions,
    cssOptions: CSSParseOption,
) {
    let textStart = 0
    for (const { range, expr, exprOffset, quote, comments } of iterateVBind(
        code,
        cssOptions,
    )) {
        insertComments(
            document,
            comments.map((c) =>
                createSimpleToken(
                    c.type,
                    locationCalculator.getOffsetWithGap(c.range[0]),
                    locationCalculator.getOffsetWithGap(c.range[1]),
                    c.value,
                    locationCalculator,
                ),
            ),
        )

        const container: VExpressionContainer = {
            type: "VExpressionContainer",
            range: [
                locationCalculator.getOffsetWithGap(range[0]),
                locationCalculator.getOffsetWithGap(range[1]),
            ],
            loc: {
                start: locationCalculator.getLocation(range[0]),
                end: locationCalculator.getLocation(range[1]),
            },
            parent: style,
            expression: null,
            references: [],
        }

        const beforeTokens: Token[] = [
            createSimpleToken(
                "HTMLText",
                container.range[0],
                container.range[0] + 6 /* v-bind */,
                "v-bind",
                locationCalculator,
            ),
            createSimpleToken(
                "Punctuator",
                container.range[0] + 6 /* v-bind */,
                container.range[0] + 7,
                "(",
                locationCalculator,
            ),
        ]
        const afterTokens: Token[] = [
            createSimpleToken(
                "Punctuator",
                container.range[1] - 1,
                container.range[1],
                ")",
                locationCalculator,
            ),
        ]
        if (quote) {
            const openStart = locationCalculator.getOffsetWithGap(
                exprOffset - 1,
            )
            beforeTokens.push(
                createSimpleToken(
                    "Punctuator",
                    openStart,
                    openStart + 1,
                    quote,
                    locationCalculator,
                ),
            )
            const closeStart = locationCalculator.getOffsetWithGap(
                exprOffset + expr.length,
            )
            afterTokens.unshift(
                createSimpleToken(
                    "Punctuator",
                    closeStart,
                    closeStart + 1,
                    quote,
                    locationCalculator,
                ),
            )
        }
        const beforeLast = beforeTokens[beforeTokens.length - 1]
        replaceAndSplitTokens(
            document,
            {
                range: [container.range[0], beforeLast.range[1]],
                loc: { start: container.loc.start, end: beforeLast.loc.end },
            },
            beforeTokens,
        )
        const afterFirst = afterTokens[0]
        replaceAndSplitTokens(
            document,
            {
                range: [afterFirst.range[0], container.range[1]],
                loc: { start: afterFirst.loc.start, end: container.loc.end },
            },
            afterTokens,
        )

        const lastChild = style.children[style.children.length - 1]
        style.children.push(container)
        if (lastChild.type === "VText") {
            const newTextNode: VText = {
                type: "VText",
                range: [container.range[1], lastChild.range[1]],
                loc: {
                    start: { ...container.loc.end },
                    end: { ...lastChild.loc.end },
                },
                parent: style,
                value: code.slice(range[1]),
            }
            style.children.push(newTextNode)

            lastChild.range[1] = container.range[0]
            lastChild.loc.end = { ...container.loc.start }
            lastChild.value = code.slice(textStart, range[0])
            textStart = range[1]
        }
        try {
            const ret = parseExpression(
                expr,
                locationCalculator.getSubCalculatorShift(exprOffset),
                parserOptions,
                { allowEmpty: false, allowFilters: false },
            )
            if (ret.expression) {
                ret.expression.parent = container
                container.expression = ret.expression
                container.references = ret.references
            }
            replaceAndSplitTokens(
                document,
                {
                    range: [beforeLast.range[1], afterFirst.range[0]],
                    loc: {
                        start: beforeLast.loc.end,
                        end: afterFirst.loc.start,
                    },
                },
                ret.tokens,
            )
            insertComments(document, ret.comments)

            for (const variable of ret.variables) {
                style.variables.push(variable)
            }
            resolveReferences(container)
        } catch (err) {
            debug("[style] Parse error: %s", err)

            if (ParseError.isParseError(err)) {
                insertError(document, err)
            } else {
                throw err
            }
        }
    }
}

type VBindLocations = {
    range: OffsetRange
    expr: string
    exprOffset: number
    quote: '"' | "'" | null
    comments: {
        type: string
        range: OffsetRange
        value: string
    }[]
}

/**
 * Iterate the `v-bind()` information.
 */
function* iterateVBind(
    code: string,
    cssOptions: CSSParseOption,
): IterableIterator<VBindLocations> {
    const re = cssOptions.inlineComment
        ? /"|'|\/[*/]|\bv-bind\(/gu
        : /"|'|\/\*|\bv-bind\(/gu
    let match
    while ((match = re.exec(code))) {
        const startOrVBind = match[0]
        if (startOrVBind === '"' || startOrVBind === "'") {
            // skip string
            re.lastIndex = skipString(code, startOrVBind, re.lastIndex)
        } else if (startOrVBind === "/*" || startOrVBind === "//") {
            // skip comment
            re.lastIndex = skipComment(
                code,
                startOrVBind === "/*" ? "block" : "line",
                re.lastIndex,
            )
        } else {
            // v-bind
            const start = match.index
            const arg = parseVBindArg(code, re.lastIndex, cssOptions)
            if (!arg) {
                continue
            }
            yield {
                range: [start, arg.end],
                expr: arg.expr,
                exprOffset: arg.exprOffset,
                quote: arg.quote,
                comments: arg.comments,
            }
            re.lastIndex = arg.end
        }
    }
}

function parseVBindArg(
    code: string,
    nextIndex: number,
    cssOptions: CSSParseOption,
): {
    expr: string
    exprOffset: number
    quote: '"' | "'" | null
    end: number
    comments: {
        type: string
        range: OffsetRange
        value: string
    }[]
} | null {
    const re = cssOptions.inlineComment ? /"|'|\/[*/]|\)/gu : /"|'|\/\*|\)/gu
    const startTokenIndex = (re.lastIndex = skipSpaces(code, nextIndex))
    let match
    const stringRanges: OffsetRange[] = []
    const comments: {
        type: string
        range: OffsetRange
        value: string
    }[] = []
    while ((match = re.exec(code))) {
        const startOrVBind = match[0]
        if (startOrVBind === '"' || startOrVBind === "'") {
            const start = match.index
            const end = (re.lastIndex = skipString(
                code,
                startOrVBind,
                re.lastIndex,
            ))
            stringRanges.push([start, end])
        } else if (startOrVBind === "/*" || startOrVBind === "//") {
            const block = startOrVBind === "/*"
            const start = match.index
            const end = (re.lastIndex = skipComment(
                code,
                block ? "block" : "line",
                re.lastIndex,
            ))
            comments.push({
                type: block ? "Block" : "Line",
                range: [start, end],
                value: block
                    ? code.slice(start + 2, end - 2)
                    : code.slice(start + 2, end - 1),
            })
        } else {
            // closing paren
            if (stringRanges.length === 1) {
                // for v-bind( 'expr' ), and v-bind( /**/ 'expr' /**/ )
                const range = stringRanges[0]
                const exprRange: OffsetRange = [range[0] + 1, range[1] - 1]
                return {
                    expr: code.slice(...exprRange),
                    exprOffset: exprRange[0],
                    quote: code[range[0]] as '"' | "'",
                    end: re.lastIndex,
                    comments,
                }
            }

            return {
                expr: code.slice(startTokenIndex, match.index).trim(),
                exprOffset: startTokenIndex,
                quote: null,
                end: re.lastIndex,
                comments: [],
            }
        }
    }
    return null
}

function skipString(code: string, quote: '"' | "'", nextIndex: number): number {
    for (let index = nextIndex; index < code.length; index++) {
        const c = code[index]
        if (c === "\\") {
            index++ // escaping
            continue
        }
        if (c === quote) {
            return index + 1
        }
    }
    return code.length
}

function skipComment(
    code: string,
    kind: "block" | "line",
    nextIndex: number,
): number {
    const closing = kind === "block" ? "*/" : "\n"
    const index = code.indexOf(closing, nextIndex)
    if (index >= nextIndex) {
        return index + closing.length
    }
    return code.length
}

function skipSpaces(code: string, nextIndex: number): number {
    for (let index = nextIndex; index < code.length; index++) {
        const c = code[index]
        if (c.trim()) {
            return index
        }
    }
    return code.length
}
