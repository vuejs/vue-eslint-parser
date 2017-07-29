/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import assert from "assert"
import {ErrorCode, HasLocation, Namespace, ParseError, Token, VAttribute} from "../ast"
import {debug} from "../common/debug"
import {Tokenizer, TokenizerState, TokenType} from "./tokenizer"

const DUMMY_PARENT: any = Object.freeze({})

/**
 * The type of intermediate tokens.
 */
export type IntermediateToken = StartTag | EndTag | Text

/**
 * The type of start tags.
 */
export interface StartTag extends HasLocation {
    type: "StartTag"
    name: string
    selfClosing: boolean
    attributes: VAttribute[]
}

/**
 * The type of end tags.
 */
export interface EndTag extends HasLocation {
    type: "EndTag"
    name: string
}

/**
 * The type of text chunks.
 */
export interface Text extends HasLocation {
    type: "Text"
    value: string
}

/**
 * The class to create HTML tokens from ESTree-like tokens which are created by a Tokenizer.
 */
export class IntermediateTokenizer {
    private tokenizer: Tokenizer
    private currentToken: IntermediateToken | null
    private currentAttribute: VAttribute | null

    public readonly tokens: Token[]
    public readonly comments: Token[]

    /**
     * The parse errors.
     */
    get errors(): ParseError[] {
        return this.tokenizer.errors
    }

    /**
     * The current state.
     */
    get state(): TokenizerState {
        return this.tokenizer.state
    }
    set state(value: TokenizerState) { //eslint-disable-line require-jsdoc
        this.tokenizer.state = value
    }

    /**
     * The current namespace.
     */
    get namespace(): Namespace {
        return this.tokenizer.namespace
    }
    set namespace(value: Namespace) { //eslint-disable-line require-jsdoc
        this.tokenizer.namespace = value
    }

    /**
     * The current flag of expression enabled.
     */
    get expressionEnabled(): boolean {
        return this.tokenizer.expressionEnabled
    }
    set expressionEnabled(value: boolean) { //eslint-disable-line require-jsdoc
        this.tokenizer.expressionEnabled = value
    }

    /**
     * Initialize this intermediate tokenizer.
     * @param tokenizer The tokenizer.
     */
    constructor(tokenizer: Tokenizer) {
        this.tokenizer = tokenizer
        this.currentToken = null
        this.currentAttribute = null
        this.tokens = []
        this.comments = []
    }

    /**
     * Get the next intermediate token.
     * @returns The intermediate token or null.
     */
    nextToken(): IntermediateToken | null {
        let token: Token | null = null
        let result: IntermediateToken | null = null

        while (result == null && (token = this.tokenizer.nextToken()) != null) {
            result = this[token.type as TokenType](token)
        }

        if (result == null && token == null && this.currentToken != null) {
            result = this.commit()
        }

        return result
    }

    /**
     * Commit the current token.
     */
    private commit(): IntermediateToken {
        assert(this.currentToken != null)

        const token = this.currentToken
        this.currentToken = null
        this.currentAttribute = null

        return token as IntermediateToken
    }

    /**
     * Report an invalid character error.
     * @param code The error code.
     */
    private reportParseError(token: HasLocation, code: ErrorCode): void {
        const error = ParseError.fromCode(code, token.range[0], token.loc.start.line, token.loc.start.column)
        this.errors.push(error)

        debug("[html] syntax error:", error.message)
    }

    /**
     * Process the given comment token.
     * @param token The comment token to process.
     */
    private processComment(token: Token): IntermediateToken | null {
        this.comments.push(token)

        if (this.currentToken != null && this.currentToken.type === "Text") {
            return this.commit()
        }
        return null
    }

    /**
     * Process the given text token.
     * @param token The text token to process.
     */
    private processText(token: Token): IntermediateToken | null {
        this.tokens.push(token)

        let result: IntermediateToken | null = null

        if (this.currentToken != null && this.currentToken.type === "Text") {
            if (this.currentToken.range[1] === token.range[0]) {
                this.currentToken.value += token.value
                this.currentToken.range[1] = token.range[1]
                this.currentToken.loc.end = token.loc.end
                return null
            }

            result = this.commit()
        }
        assert(this.currentToken == null)

        this.currentToken = {
            type: "Text",
            range: [token.range[0], token.range[1]],
            loc: {start: token.loc.start, end: token.loc.end},
            value: token.value,
        }

        return result
    }

    /**
     * Process a HTMLAssociation token.
     * @param token The token to process.
     */
    protected HTMLAssociation(token: Token): IntermediateToken | null {
        this.tokens.push(token)

        if (this.currentAttribute != null) {
            this.currentAttribute.range[1] = token.range[1]
            this.currentAttribute.loc.end = token.loc.end

            if (this.currentToken == null || this.currentToken.type !== "StartTag") {
                throw new Error("unreachable")
            }
            this.currentToken.range[1] = token.range[1]
            this.currentToken.loc.end = token.loc.end
        }

        return null
    }

    /**
     * Process a HTMLBogusComment token.
     * @param token The token to process.
     */
    protected HTMLBogusComment(token: Token): IntermediateToken | null {
        return this.processComment(token)
    }

    /**
     * Process a HTMLCDataText token.
     * @param token The token to process.
     */
    protected HTMLCDataText(token: Token): IntermediateToken | null {
        return this.processText(token)
    }

    /**
     * Process a HTMLComment token.
     * @param token The token to process.
     */
    protected HTMLComment(token: Token): IntermediateToken | null {
        return this.processComment(token)
    }

    /**
     * Process a HTMLEndTagOpen token.
     * @param token The token to process.
     */
    protected HTMLEndTagOpen(token: Token): IntermediateToken | null {
        this.tokens.push(token)

        let result: IntermediateToken | null = null

        if (this.currentToken != null) {
            result = this.commit()
        }

        this.currentToken = {
            type: "EndTag",
            range: [token.range[0], token.range[1]],
            loc: {start: token.loc.start, end: token.loc.end},
            name: token.value,
        }

        return result
    }

    /**
     * Process a HTMLIdentifier token.
     * @param token The token to process.
     */
    protected HTMLIdentifier(token: Token): IntermediateToken | null {
        this.tokens.push(token)

        if (this.currentToken == null || this.currentToken.type === "Text") {
            throw new Error("unreachable")
        }
        if (this.currentToken.type === "EndTag") {
            this.reportParseError(token, "end-tag-with-attributes")
            return null
        }

        this.currentAttribute = {
            type: "VAttribute",
            range: [token.range[0], token.range[1]],
            loc: {start: token.loc.start, end: token.loc.end},
            parent: DUMMY_PARENT,
            directive: false,
            key: {
                type: "VIdentifier",
                range: [token.range[0], token.range[1]],
                loc: {start: token.loc.start, end: token.loc.end},
                parent: DUMMY_PARENT,
                name: token.value,
            },
            value: null,
        }
        this.currentAttribute.key.parent = this.currentAttribute

        this.currentToken.range[1] = token.range[1]
        this.currentToken.loc.end = token.loc.end
        this.currentToken.attributes.push(this.currentAttribute)

        return null
    }

    /**
     * Process a HTMLLiteral token.
     * @param token The token to process.
     */
    protected HTMLLiteral(token: Token): IntermediateToken | null {
        this.tokens.push(token)

        if (this.currentAttribute != null) {
            this.currentAttribute.range[1] = token.range[1]
            this.currentAttribute.loc.end = token.loc.end
            this.currentAttribute.value = {
                type: "VLiteral",
                range: [token.range[0], token.range[1]],
                loc: {start: token.loc.start, end: token.loc.end},
                parent: this.currentAttribute,
                value: token.value,
            }

            if (this.currentToken == null || this.currentToken.type !== "StartTag") {
                throw new Error("unreachable")
            }
            this.currentToken.range[1] = token.range[1]
            this.currentToken.loc.end = token.loc.end
        }

        return null
    }

    /**
     * Process a HTMLRCDataText token.
     * @param token The token to process.
     */
    protected HTMLRCDataText(token: Token): IntermediateToken | null {
        return this.processText(token)
    }

    /**
     * Process a HTMLRawText token.
     * @param token The token to process.
     */
    protected HTMLRawText(token: Token): IntermediateToken | null {
        return this.processText(token)
    }

    /**
     * Process a HTMLSelfClosingTagClose token.
     * @param token The token to process.
     */
    protected HTMLSelfClosingTagClose(token: Token): IntermediateToken | null {
        this.tokens.push(token)

        if (this.currentToken == null || this.currentToken.type === "Text") {
            throw new Error("unreachable")
        }

        if (this.currentToken.type === "StartTag") {
            this.currentToken.selfClosing = true
        }
        else {
            this.reportParseError(token, "end-tag-with-trailing-solidus")
        }

        this.currentToken.range[1] = token.range[1]
        this.currentToken.loc.end = token.loc.end

        return this.commit()
    }

    /**
     * Process a HTMLTagClose token.
     * @param token The token to process.
     */
    protected HTMLTagClose(token: Token): IntermediateToken | null {
        this.tokens.push(token)

        if (this.currentToken == null || this.currentToken.type === "Text") {
            throw new Error("unreachable")
        }

        this.currentToken.range[1] = token.range[1]
        this.currentToken.loc.end = token.loc.end

        return this.commit()
    }

    /**
     * Process a HTMLTagOpen token.
     * @param token The token to process.
     */
    protected HTMLTagOpen(token: Token): IntermediateToken | null {
        this.tokens.push(token)

        let result: IntermediateToken | null = null

        if (this.currentToken != null) {
            result = this.commit()
        }

        this.currentToken = {
            type: "StartTag",
            range: [token.range[0], token.range[1]],
            loc: {start: token.loc.start, end: token.loc.end},
            name: token.value,
            selfClosing: false,
            attributes: [],
        }

        return result
    }

    /**
     * Process a HTMLText token.
     * @param token The token to process.
     */
    protected HTMLText(token: Token): IntermediateToken | null {
        return this.processText(token)
    }

    /**
     * Process a HTMLWhitespace token.
     * @param token The token to process.
     */
    protected HTMLWhitespace(token: Token): IntermediateToken | null {
        return this.processText(token)
    }

    /**
     * Process a VExpressionStart token.
     * @param token The token to process.
     */
    protected VExpressionStart(token: Token): IntermediateToken | null {
        return this.processText(token)
    }

    /**
     * Process a VExpressionEnd token.
     * @param token The token to process.
     */
    protected VExpressionEnd(token: Token): IntermediateToken | null {
        return this.processText(token)
    }
}
