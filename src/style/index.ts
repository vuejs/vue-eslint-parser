import type {
    OffsetRange,
    VElement,
    VExpressionContainer,
    VStyleElement,
    VText,
} from "../ast"
import { ParseError } from "../ast"
import { getOwnerDocument } from "../common/ast-utils"
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
        )
    }
}

function parseStyle(
    style: VStyleElement,
    locationCalculator: LocationCalculatorForHtml,
    parserOptions: ParserOptions,
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
    for (const { range, expr, exprOffset, quote } of iterateVBind(
        textNode.range[0],
        text,
    )) {
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
                ret.tokens.unshift(
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
                    ...(quote
                        ? [
                              (() => {
                                  const start =
                                      locationCalculator.getOffsetWithGap(
                                          exprOffset - 1,
                                      )
                                  return createSimpleToken(
                                      "Punctuator",
                                      start,
                                      start + 1,
                                      quote,
                                      locationCalculator,
                                  )
                              })(),
                          ]
                        : []),
                )
                ret.tokens.push(
                    ...(quote
                        ? [
                              (() => {
                                  const start =
                                      locationCalculator.getOffsetWithGap(
                                          exprOffset + expr.length,
                                      )
                                  return createSimpleToken(
                                      "Punctuator",
                                      start,
                                      start + 1,
                                      quote,
                                      locationCalculator,
                                  )
                              })(),
                          ]
                        : []),
                    createSimpleToken(
                        "Punctuator",
                        container.range[1] - 1,
                        container.range[1],
                        ")",
                        locationCalculator,
                    ),
                )

                replaceAndSplitTokens(document, container, ret.tokens)
            }

            insertComments(document, ret.comments)

            const lastChild = style.children[style.children.length - 1]
            style.children.push(container)

            for (const variable of ret.variables) {
                style.variables.push(variable)
            }
            resolveReferences(container)

            if (lastChild.type === "VText") {
                const newTextNode: VText = {
                    type: "VText",
                    range: [container.range[1], lastChild.range[1]],
                    loc: {
                        start: { ...container.loc.end },
                        end: { ...lastChild.loc.end },
                    },
                    parent: style,
                    value: text.slice(range[1]),
                }
                style.children.push(newTextNode)

                lastChild.range[1] = container.range[0]
                lastChild.loc.end = { ...container.loc.start }
                lastChild.value = text.slice(textStart, range[0])
                textStart = range[1]
            }
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
}

// eslint-disable-next-line complexity
function* iterateVBind(
    offset: number,
    text: string,
): IterableIterator<VBindLocations> {
    const re =
        /"|'|\/\*|\/\/|\bv-bind\(\s*(?:'([^']+)'|"([^"]+)"|([^'"][^)]*))\s*\)/gu
    let match
    while ((match = re.exec(text))) {
        const startOrVBind = match[0]
        if (startOrVBind === '"' || startOrVBind === '"') {
            // skip string
            for (let index = re.lastIndex; index < text.length; index++) {
                const c = text[index]
                if (c === "\\") {
                    continue
                } // escaping
                if (c === startOrVBind) {
                    re.lastIndex = index + 1
                    break
                }
            }
        } else if (startOrVBind === "/*") {
            // skip comment
            const index = text.indexOf("*/", re.lastIndex)
            if (index >= re.lastIndex) {
                re.lastIndex = index
            }
        } else if (startOrVBind === "//") {
            // skip inline comment
            const index = text.indexOf("\n", re.lastIndex)
            if (index >= re.lastIndex) {
                re.lastIndex = index
            }
        } else {
            // v-bind
            const vBind = startOrVBind
            const quote = match[1] ? "'" : match[2] ? '"' : null
            const expr = match[1] || match[2] || match[3]
            const start = match.index + offset
            const end = re.lastIndex + offset
            const exprOffset =
                start +
                vBind.indexOf(quote || match[3], 7 /* v-bind( */) +
                (quote ? 1 /* quote */ : 0)
            yield {
                range: [start, end],
                expr,
                exprOffset,
                quote,
            }
        }
    }
}
