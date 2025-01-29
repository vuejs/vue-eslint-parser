import type {
    OffsetRange,
    Token,
    VDocumentFragment,
    VElement,
    VExpressionContainer,
    VStyleElement,
    VText,
} from "../ast/index"
import { ParseError } from "../ast/index"
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
import { parseExpression } from "../script/index"
import { DEFAULT_ECMA_VERSION } from "../script-setup/parser-options"
import { resolveReferences } from "../template/index"
import type {
    CSSCommentToken,
    CSSPunctuatorToken,
    CSSToken,
    CSSTokenizeOption,
} from "./tokenizer"
import { CSSTokenType, CSSTokenizer } from "./tokenizer"

class CSSTokenScanner {
    private reconsuming: CSSToken[] = []
    private tokenizer: CSSTokenizer
    public constructor(text: string, options: CSSTokenizeOption) {
        this.tokenizer = new CSSTokenizer(text, 0, options)
    }
    public nextToken(): CSSToken | null {
        return this.reconsuming.shift() || this.tokenizer.nextToken()
    }
    public reconsume(...tokens: CSSToken[]) {
        this.reconsuming.push(...tokens)
    }
}

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
    cssOptions: CSSTokenizeOption,
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
    if (!/v-bind\s*(?:\(|\/)/u.test(code)) {
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
    cssOptions: CSSTokenizeOption,
) {
    let textStart = 0
    for (const {
        range,
        exprRange,
        quote,
        openingParenOffset,
        comments,
    } of iterateVBind(code, cssOptions)) {
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

        const openingParenStart =
            locationCalculator.getOffsetWithGap(openingParenOffset)
        const beforeTokens: Token[] = [
            createSimpleToken(
                "HTMLRawText",
                container.range[0],
                container.range[0] + 6 /* v-bind */,
                "v-bind",
                locationCalculator,
            ),
            createSimpleToken(
                "Punctuator",
                openingParenStart,
                openingParenStart + 1,
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
                exprRange[0] - 1,
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
            const closeStart = locationCalculator.getOffsetWithGap(exprRange[1])
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
                code.slice(...exprRange),
                locationCalculator.getSubCalculatorShift(exprRange[0]),
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
    exprRange: OffsetRange
    quote: '"' | "'" | null
    openingParenOffset: number
    comments: CSSCommentToken[]
}

/**
 * Iterate the `v-bind()` information.
 */
function* iterateVBind(
    code: string,
    cssOptions: CSSTokenizeOption,
): IterableIterator<VBindLocations> {
    const tokenizer = new CSSTokenScanner(code, cssOptions)

    let token
    while ((token = tokenizer.nextToken())) {
        if (token.type !== CSSTokenType.Word || token.value !== "v-bind") {
            continue
        }
        const openingParen = findVBindOpeningParen(tokenizer)
        if (!openingParen) {
            continue
        }
        const arg = parseVBindArg(tokenizer)
        if (!arg) {
            continue
        }
        yield {
            range: [token.range[0], arg.closingParen.range[1]],
            exprRange: arg.exprRange,
            quote: arg.quote,
            openingParenOffset: openingParen.openingParen.range[0],
            comments: [...openingParen.comments, ...arg.comments],
        }
    }
}

function findVBindOpeningParen(tokenizer: CSSTokenScanner): {
    openingParen: CSSPunctuatorToken
    comments: CSSCommentToken[]
} | null {
    const comments: CSSCommentToken[] = []
    let token
    while ((token = tokenizer.nextToken())) {
        if (token.type === CSSTokenType.Punctuator && token.value === "(") {
            return {
                openingParen: token,
                comments,
            }
        } else if (isComment(token)) {
            // Comment between `v-bind` and opening paren.
            comments.push(token)
            continue
        }
        tokenizer.reconsume(...comments, token)
        // There were no opening parens.
        return null
    }
    return null
}

function parseVBindArg(tokenizer: CSSTokenScanner): {
    exprRange: OffsetRange
    quote: '"' | "'" | null
    closingParen: CSSPunctuatorToken
    comments: CSSCommentToken[]
} | null {
    const tokensBuffer: CSSToken[] = []
    const comments: CSSCommentToken[] = []
    const tokens: CSSToken[] = []
    const closeTokenStack: string[] = []
    let token
    while ((token = tokenizer.nextToken())) {
        if (token.type === CSSTokenType.Punctuator) {
            if (token.value === ")" && !closeTokenStack.length) {
                if (
                    tokens.length === 1 &&
                    tokens[0].type === CSSTokenType.Quoted
                ) {
                    // for v-bind( 'expr' ), and v-bind( /**/ 'expr' /**/ )
                    const quotedToken = tokens[0]
                    return {
                        exprRange: quotedToken.valueRange,
                        quote: quotedToken.quote,
                        closingParen: token,
                        comments,
                    }
                }
                const startToken = tokensBuffer[0] || token
                return {
                    exprRange: [startToken.range[0], token.range[0]],
                    quote: null,
                    closingParen: token,
                    comments: [],
                }
            }

            if (token.value === closeTokenStack[0]) {
                closeTokenStack.shift()
            } else if (token.value === "(") {
                closeTokenStack.unshift(")")
            }
        }

        tokensBuffer.push(token)
        if (isComment(token)) {
            comments.push(token)
        } else {
            tokens.push(token)
        }
    }
    tokenizer.reconsume(...tokensBuffer)
    return null
}

function isComment(token: CSSToken): token is CSSCommentToken {
    return token.type === CSSTokenType.Block || token.type === CSSTokenType.Line
}
