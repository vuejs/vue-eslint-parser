import type {
    OffsetRange,
    Token,
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
        parseStyle(
            style as VStyleElement,
            globalLocationCalculator,
            parserOptions,
            {
                inlineComment: (getLang(style) || "css") !== "css",
            },
        )
    }
}

function parseStyle(
    style: VStyleElement,
    locationCalculator: LocationCalculatorForHtml,
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
    const text = textNode.value
    if (!text.includes("v-bind(")) {
        return
    }

    const document = getOwnerDocument(style)

    let textStart = 0
    for (const { range, expr, exprOffset, quote, comments } of iterateVBind(
        textNode.range[0],
        text,
        cssOptions,
    )) {
        insertComments(
            document,
            comments.map((c) => ({
                type: c.type,
                range: [
                    locationCalculator.getOffsetWithGap(c.range[0]),
                    locationCalculator.getOffsetWithGap(c.range[1]),
                ],
                loc: {
                    start: locationCalculator.getLocation(c.range[0]),
                    end: locationCalculator.getLocation(c.range[1]),
                },
                value: c.value,
            })),
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
                value: text.slice(range[1] - textNode.range[0]),
            }
            style.children.push(newTextNode)

            lastChild.range[1] = container.range[0]
            lastChild.loc.end = { ...container.loc.start }
            lastChild.value = text.slice(
                textStart,
                range[0] - textNode.range[0],
            )
            textStart = range[1] - textNode.range[0]
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
    offset: number,
    text: string,
    cssOptions: CSSParseOption,
): IterableIterator<VBindLocations> {
    const re = cssOptions.inlineComment
        ? /"|'|\/\*|\/\/|\bv-bind\(/gu
        : /"|'|\/\*|\bv-bind\(/gu
    let match
    while ((match = re.exec(text))) {
        const startOrVBind = match[0]
        if (startOrVBind === '"' || startOrVBind === "'") {
            // skip string
            re.lastIndex = skipString(text, startOrVBind, re.lastIndex)
        } else if (startOrVBind === "/*" || startOrVBind === "//") {
            // skip comment
            re.lastIndex = skipComment(
                text,
                startOrVBind === "/*" ? "block" : "line",
                re.lastIndex,
            )
        } else {
            // v-bind
            const start = match.index + offset
            const arg = extractArg(text, re.lastIndex, cssOptions)
            if (!arg) {
                continue
            }
            yield {
                range: [start, arg.end + offset],
                expr: arg.expr,
                exprOffset: arg.exprOffset + offset,
                quote: arg.quote,
                comments: arg.comments.map((c) => ({
                    ...c,
                    range: [c.range[0] + offset, c.range[1] + offset],
                })),
            }
            re.lastIndex = arg.end
        }
    }
}

function extractArg(
    text: string,
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
    ;/\S/gu.exec(text)
    const re = cssOptions.inlineComment ? /"|'|\/\*|\/\/|\)/gu : /"|'|\/\*|\)/gu
    const startTokenIndex = (re.lastIndex = skipSpaces(text, nextIndex))
    let match
    const stringRanges: OffsetRange[] = []
    const comments: {
        type: string
        range: OffsetRange
        value: string
    }[] = []
    while ((match = re.exec(text))) {
        const startOrVBind = match[0]
        if (startOrVBind === '"' || startOrVBind === "'") {
            const start = match.index
            const end = (re.lastIndex = skipString(
                text,
                startOrVBind,
                re.lastIndex,
            ))
            stringRanges.push([start, end])
        } else if (startOrVBind === "/*" || startOrVBind === "//") {
            const block = startOrVBind === "/*"
            const start = match.index
            const end = (re.lastIndex = skipComment(
                text,
                block ? "block" : "line",
                re.lastIndex,
            ))
            comments.push({
                type: block ? "Block" : "Line",
                range: [start, end],
                value: block
                    ? text.slice(start + 2, end - 2)
                    : text.slice(start + 2, end - 1),
            })
        } else {
            // close paren
            if (stringRanges.length === 1) {
                const range = stringRanges[0]
                const exprRange: OffsetRange = [range[0] + 1, range[1] - 1]
                return {
                    expr: text.slice(...exprRange),
                    exprOffset: exprRange[0],
                    quote: text[range[0]] as '"' | "'",
                    end: re.lastIndex,
                    comments,
                }
            }

            return {
                expr: text.slice(startTokenIndex, match.index).trim(),
                exprOffset: startTokenIndex,
                quote: null,
                end: re.lastIndex,
                comments: [],
            }
        }
    }
    return null
}

function skipString(text: string, quote: string, nextIndex: number): number {
    for (let index = nextIndex; index < text.length; index++) {
        const c = text[index]
        if (c === "\\") {
            index++ // escaping
            continue
        }
        if (c === quote) {
            return index + 1
        }
    }
    return nextIndex
}

function skipComment(
    text: string,
    kind: "block" | "line",
    nextIndex: number,
): number {
    const index = text.indexOf(kind === "block" ? "*/" : "\n", nextIndex)
    return Math.max(index, nextIndex)
}

function skipSpaces(text: string, nextIndex: number): number {
    for (let index = nextIndex; index < text.length; index++) {
        const c = text[index]
        if (c.trim()) {
            return index
        }
    }
    return text.length
}
