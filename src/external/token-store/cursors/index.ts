/**
 * @fileoverview Define 2 token factories; forward and backward.
 * @author Toru Nagashima
 */
import {Token} from "../../../ast"
import BackwardTokenCommentCursor from "./backward-token-comment-cursor"
import BackwardTokenCursor from "./backward-token-cursor"
import Cursor from "./cursor"
import FilterCursor from "./filter-cursor"
import ForwardTokenCommentCursor from "./forward-token-comment-cursor"
import ForwardTokenCursor from "./forward-token-cursor"
import LimitCursor from "./limit-cursor"
import SkipCursor from "./skip-cursor"

/**
 * The cursor factory.
 * @private
 */
export class CursorFactory {
    private TokenCursor: typeof BackwardTokenCursor | typeof ForwardTokenCursor
    private TokenCommentCursor: typeof BackwardTokenCommentCursor | typeof ForwardTokenCommentCursor

    /**
     * Initializes this cursor.
     * @param TokenCursor - The class of the cursor which iterates tokens only.
     * @param TokenCommentCursor - The class of the cursor which iterates the mix of tokens and comments.
     */
    constructor(TokenCursor: typeof BackwardTokenCursor | typeof ForwardTokenCursor, TokenCommentCursor: typeof BackwardTokenCommentCursor | typeof ForwardTokenCommentCursor) {
        this.TokenCursor = TokenCursor
        this.TokenCommentCursor = TokenCommentCursor
    }

    /**
     * Creates a base cursor instance that can be decorated by createCursor.
     *
     * @param tokens - The array of tokens.
     * @param comments - The array of comments.
     * @param indexMap - The map from locations to indices in `tokens`.
     * @param startLoc - The start location of the iteration range.
     * @param endLoc - The end location of the iteration range.
     * @param includeComments - The flag to iterate comments as well.
     * @returns The created base cursor.
     */
    createBaseCursor(tokens: Token[], comments: Token[], indexMap: { [key: number]: number }, startLoc: number, endLoc: number, includeComments: boolean): Cursor {
        const TokenCursor = includeComments ? this.TokenCommentCursor : this.TokenCursor
        return new TokenCursor(tokens, comments, indexMap, startLoc, endLoc)
    }

    /**
     * Creates a cursor that iterates tokens with normalized options.
     *
     * @param tokens - The array of tokens.
     * @param comments - The array of comments.
     * @param indexMap - The map from locations to indices in `tokens`.
     * @param startLoc - The start location of the iteration range.
     * @param endLoc - The end location of the iteration range.
     * @param includeComments - The flag to iterate comments as well.
     * @param filter - The predicate function to choose tokens.
     * @param skip - The count of tokens the cursor skips.
     * @param count - The maximum count of tokens the cursor iterates. Zero is no iteration for backward compatibility.
     * @returns The created cursor.
     */
    createCursor(tokens: Token[], comments: Token[], indexMap: { [key: number]: number }, startLoc: number, endLoc: number, includeComments: boolean, filter: ((token: Token) => boolean) | null, skip: number, count: number): Cursor {
        let cursor = this.createBaseCursor(tokens, comments, indexMap, startLoc, endLoc, includeComments)

        if (filter) {
            cursor = new FilterCursor(cursor, filter)
        }
        if (skip >= 1) {
            cursor = new SkipCursor(cursor, skip)
        }
        if (count >= 0) {
            cursor = new LimitCursor(cursor, count)
        }

        return cursor
    }
}

export const forward = new CursorFactory(ForwardTokenCursor, ForwardTokenCommentCursor)
export const backward = new CursorFactory(BackwardTokenCursor, BackwardTokenCommentCursor)
