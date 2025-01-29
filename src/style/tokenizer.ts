import { debug } from "../common/debug"
import type { OffsetRange } from "../ast/index"
import {
    APOSTROPHE,
    ASTERISK,
    CARRIAGE_RETURN,
    EOF,
    isWhitespace,
    LEFT_CURLY_BRACKET,
    LEFT_PARENTHESIS,
    LINE_FEED,
    NULL,
    QUOTATION_MARK,
    REVERSE_SOLIDUS,
    RIGHT_CURLY_BRACKET,
    RIGHT_PARENTHESIS,
    SOLIDUS,
    COLON,
    SEMICOLON,
    LEFT_SQUARE_BRACKET,
    RIGHT_SQUARE_BRACKET,
} from "../html/util/unicode"

export const enum CSSTokenType {
    Quoted = "Quoted",
    Block = "Block",
    Line = "Line",
    Word = "Word",
    Punctuator = "Punctuator",
}

export interface CSSWordToken {
    type: CSSTokenType.Word
    value: string
    range: OffsetRange
}
export interface CSSQuotedToken {
    type: CSSTokenType.Quoted
    valueRange: OffsetRange
    value: string
    range: OffsetRange
    quote: '"' | "'"
}
export interface CSSPunctuatorToken {
    type: CSSTokenType.Punctuator
    value: string
    range: OffsetRange
}
export interface CSSCommentToken {
    type: CSSTokenType.Block | CSSTokenType.Line
    valueRange: OffsetRange
    value: string
    range: OffsetRange
}
export type CSSToken =
    | CSSWordToken
    | CSSQuotedToken
    | CSSPunctuatorToken
    | CSSCommentToken

export type CSSTokenizeOption = { inlineComment?: boolean }

/**
 * A simplified CSS tokenizer.
 * The tokenizer is implemented with reference to the CSS specification,
 * but it does not follow it. This tokenizer only does the tokenization needed to properly handle `v-bind()`.
 * @see https://drafts.csswg.org/css-syntax/#tokenization
 */
export class CSSTokenizer {
    // Reading
    public readonly text: string
    private readonly options: CSSTokenizeOption
    private cp: number
    private offset: number
    private nextOffset: number

    // Tokenizing
    private reconsuming: boolean

    /**
     * Initialize this tokenizer.
     * @param text The source code to tokenize.
     * @param options The tokenizer options.
     */
    public constructor(
        text: string,
        startOffset: number,
        options?: CSSTokenizeOption,
    ) {
        debug("[css] the source code length: %d", text.length)
        this.text = text
        this.options = {
            inlineComment: options?.inlineComment ?? false,
        }
        this.cp = NULL
        this.offset = startOffset - 1
        this.nextOffset = startOffset
        this.reconsuming = false
    }

    /**
     * Get the next token.
     * @returns The next token or null.
     */
    public nextToken(): CSSToken | null {
        let cp
        if (this.reconsuming) {
            cp = this.cp
            this.reconsuming = false
        } else {
            cp = this.consumeNextCodePoint()
        }
        // Skip whitespaces
        while (isWhitespace(cp)) {
            cp = this.consumeNextCodePoint()
        }
        if (cp === EOF) {
            return null
        }

        const start = this.offset
        return this.consumeNextToken(cp, start)
    }

    /**
     * Get the next code point.
     * @returns The code point.
     */
    private nextCodePoint(): number {
        if (this.nextOffset >= this.text.length) {
            return EOF
        }
        return this.text.codePointAt(this.nextOffset)!
    }

    /**
     * Consume the next code point.
     * @returns The consumed code point.
     */
    private consumeNextCodePoint(): number {
        if (this.offset >= this.text.length) {
            this.cp = EOF
            return EOF
        }

        this.offset = this.nextOffset

        if (this.offset >= this.text.length) {
            this.cp = EOF
            return EOF
        }

        let cp = this.text.codePointAt(this.offset)!
        if (cp === CARRIAGE_RETURN) {
            this.nextOffset = this.offset + 1
            if (this.text.codePointAt(this.nextOffset)! === LINE_FEED) {
                this.nextOffset++
            }
            cp = LINE_FEED
        } else {
            this.nextOffset = this.offset + (cp >= 0x10000 ? 2 : 1)
        }

        this.cp = cp

        return cp
    }

    private consumeNextToken(cp: number, start: number): CSSToken | null {
        if (cp === SOLIDUS) {
            const nextCp = this.nextCodePoint()
            if (nextCp === ASTERISK) {
                return this.consumeComment(start)
            }
            if (nextCp === SOLIDUS && this.options.inlineComment) {
                return this.consumeInlineComment(start)
            }
        }
        if (isQuote(cp)) {
            return this.consumeString(start, cp)
        }
        if (isPunctuator(cp)) {
            return {
                type: CSSTokenType.Punctuator,
                range: [start, start + 1],
                value: String.fromCodePoint(cp),
            }
        }
        return this.consumeWord(start)
    }

    /**
     * Consume word
     */
    private consumeWord(start: number): CSSToken {
        let cp = this.consumeNextCodePoint()
        while (!isWhitespace(cp) && !isPunctuator(cp) && !isQuote(cp)) {
            cp = this.consumeNextCodePoint()
        }
        this.reconsuming = true
        const range: OffsetRange = [start, this.offset]
        const text = this.text
        let value: string
        return {
            type: CSSTokenType.Word,
            range,
            get value() {
                return (value ??= text.slice(...range))
            },
        }
    }

    /**
     * https://drafts.csswg.org/css-syntax/#consume-string-token
     */
    private consumeString(start: number, quote: number): CSSToken {
        let valueEndOffset: number | null = null
        let cp = this.consumeNextCodePoint()
        while (cp !== EOF) {
            if (cp === quote) {
                valueEndOffset = this.offset
                break
            }
            // PostCSS seems to continue parsing.
            // if (cp === LINE_FEED) {
            //     // Bad string
            //     this.reconsuming = true
            //     valueEndOffset = this.offset
            //     break
            // }
            if (cp === REVERSE_SOLIDUS) {
                // Escape
                this.consumeNextCodePoint()
            }
            cp = this.consumeNextCodePoint()
        }
        const text = this.text
        let value: string
        const valueRange: OffsetRange = [
            start + 1,
            valueEndOffset ?? this.nextOffset,
        ]
        return {
            type: CSSTokenType.Quoted,
            range: [start, this.nextOffset],
            valueRange,
            get value() {
                return (value ??= text.slice(...valueRange))
            },
            quote: String.fromCodePoint(quote) as never,
        }
    }
    /**
     * https://drafts.csswg.org/css-syntax/#consume-comment
     */
    private consumeComment(start: number): CSSToken {
        this.consumeNextCodePoint() // consume "*"
        let valueEndOffset: number | null = null
        let cp = this.consumeNextCodePoint()
        while (cp !== EOF) {
            if (cp === ASTERISK) {
                cp = this.consumeNextCodePoint()
                if (cp === SOLIDUS) {
                    valueEndOffset = this.offset - 1
                    break
                }
            }
            cp = this.consumeNextCodePoint()
        }
        const valueRange: OffsetRange = [
            start + 2,
            valueEndOffset ?? this.nextOffset,
        ]
        const text = this.text
        let value: string
        return {
            type: CSSTokenType.Block,
            range: [start, this.nextOffset],
            valueRange,
            get value() {
                return (value ??= text.slice(...valueRange))
            },
        }
    }
    /**
     * Consume inline comment
     */
    private consumeInlineComment(start: number): CSSToken {
        this.consumeNextCodePoint() // consume "/"
        let valueEndOffset: number | null = null
        let cp = this.consumeNextCodePoint()
        while (cp !== EOF) {
            if (cp === LINE_FEED) {
                valueEndOffset = this.offset - 1
                break
            }
            cp = this.consumeNextCodePoint()
        }
        const valueRange: OffsetRange = [
            start + 2,
            valueEndOffset ?? this.nextOffset,
        ]
        const text = this.text
        let value: string
        return {
            type: CSSTokenType.Line,
            range: [start, this.nextOffset],
            valueRange,
            get value() {
                return (value ??= text.slice(...valueRange))
            },
        }
    }
}

function isPunctuator(cp: number): boolean {
    return (
        cp === COLON ||
        cp === SEMICOLON ||
        // Brackets
        cp === LEFT_PARENTHESIS ||
        cp === RIGHT_PARENTHESIS ||
        cp === LEFT_CURLY_BRACKET ||
        cp === RIGHT_CURLY_BRACKET ||
        cp === LEFT_SQUARE_BRACKET ||
        cp === RIGHT_SQUARE_BRACKET ||
        // Maybe v-bind() in calc()
        cp === SOLIDUS ||
        cp === ASTERISK
    )
}

function isQuote(cp: number): boolean {
    return cp === APOSTROPHE || cp === QUOTATION_MARK
}
