/**
 * @fileoverview Define the abstract class about cursors which iterate tokens.
 * @author Toru Nagashima
 */
import {Token} from "../../../ast"

/**
 * The abstract class about cursors which iterate tokens.
 *
 * This class has 2 abstract methods.
 *
 * - `current: Token | Comment | null` ... The current token.
 * - `moveNext(): boolean` ... Moves this cursor to the next token. If the next token didn't exist, it returns `false`.
 *
 * This is similar to ES2015 Iterators.
 * However, Iterators were slow (at 2017-01), so I created this class as similar to C# IEnumerable.
 *
 * There are the following known sub classes.
 *
 * - ForwardTokenCursor .......... The cursor which iterates tokens only.
 * - BackwardTokenCursor ......... The cursor which iterates tokens only in reverse.
 * - ForwardTokenCommentCursor ... The cursor which iterates tokens and comments.
 * - BackwardTokenCommentCursor .. The cursor which iterates tokens and comments in reverse.
 * - DecorativeCursor
 *     - FilterCursor ............ The cursor which ignores the specified tokens.
 *     - SkipCursor .............. The cursor which ignores the first few tokens.
 *     - LimitCursor ............. The cursor which limits the count of tokens.
 *
 */
export default abstract class Cursor {
    current: Token | null

    /**
     * Initializes this cursor.
     */
    constructor() {
        this.current = null
    }

    /**
     * Gets the first token.
     * This consumes this cursor.
     * @returns The first token or null.
     */
    getOneToken(): Token | null {
        return this.moveNext() ? this.current : null
    }

    /**
     * Gets the first tokens.
     * This consumes this cursor.
     * @returns All tokens.
     */
    getAllTokens(): Token[] {
        const tokens: Token[] = []

        while (this.moveNext()) {
            tokens.push(this.current as Token)
        }

        return tokens
    }

    /**
     * Moves this cursor to the next token.
     * @returns {boolean} `true` if the next token exists.
     * @abstract
     */
    abstract moveNext(): boolean
}
