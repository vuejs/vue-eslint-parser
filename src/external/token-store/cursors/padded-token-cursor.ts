/**
 * @fileoverview Define the cursor which iterates tokens only, with inflated range.
 * @author Toru Nagashima
 */
import {Token} from "../../../ast"
import ForwardTokenCursor from "./forward-token-cursor"

/**
 * The cursor which iterates tokens only, with inflated range.
 * This is for the backward compatibility of padding options.
 */
export default class PaddedTokenCursor extends ForwardTokenCursor {
    /**
     * Initializes this cursor.
     * @param tokens - The array of tokens.
     * @param comments - The array of comments.
     * @param indexMap - The map from locations to indices in `tokens`.
     * @param startLoc - The start location of the iteration range.
     * @param endLoc - The end location of the iteration range.
     * @param beforeCount - The number of tokens this cursor iterates before start.
     * @param afterCount - The number of tokens this cursor iterates after end.
     */
    constructor(tokens: Token[], comments: Token[], indexMap: { [key: number]: number }, startLoc: number, endLoc: number, beforeCount: number, afterCount: number) {
        super(tokens, comments, indexMap, startLoc, endLoc)
        this.index = Math.max(0, this.index - beforeCount)
        this.indexEnd = Math.min(tokens.length - 1, this.indexEnd + afterCount)
    }
}
