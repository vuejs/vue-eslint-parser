import type { Namespace, ParseError, Token } from "../ast"
import type { IntermediateToken } from "./intermediate-tokenizer"
import type { TokenizerState } from "./tokenizer"

export interface CustomTemplateTokenizer {
    /**
     * The tokenized low level tokens, excluding comments.
     */
    readonly tokens: Token[]
    /**
     * The tokenized low level comment tokens
     */
    readonly comments: Token[]
    /**
     * The tokenized twig expression tokens
     */
    readonly twigExpressions: Token[]
    /**
     * The source code text.
     */
    readonly text: string
    /**
     * The parse errors.
     */
    readonly errors: ParseError[]
    /**
     * The current state.
     */
    state: TokenizerState
    /**
     * The current namespace.
     */
    namespace: Namespace
    /**
     * The current flag of expression enabled.
     */
    expressionEnabled: boolean
    /**
     * Get the next intermediate token.
     * @returns The intermediate token or null.
     */
    nextToken(): IntermediateToken | null
}

/**
 * Initialize tokenizer.
 * @param templateText The contents of the <template> tag.
 * @param text The complete source code
 * @param option The starting location of the templateText. Your token positions need to include this offset.
 */
export type CustomTemplateTokenizerConstructor = new (
    templateText: string,
    text: string,
    option: { startingLine: number; startingColumn: number },
) => CustomTemplateTokenizer
