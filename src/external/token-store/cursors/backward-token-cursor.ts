/**
 * @fileoverview Define the cursor which iterates tokens only in reverse.
 * @author Toru Nagashima
 */
import type { Token } from "../../../ast/index"
import { getFirstIndex, getLastIndex } from "../utils"
import Cursor from "./cursor"

/**
 * The cursor which iterates tokens only in reverse.
 */
export default class BackwardTokenCursor extends Cursor {
    private tokens: Token[]
    private index: number
    private indexEnd: number

    /**
     * Initializes this cursor.
     * @param tokens - The array of tokens.
     * @param comments - The array of comments.
     * @param indexMap - The map from locations to indices in `tokens`.
     * @param startLoc - The start location of the iteration range.
     * @param endLoc - The end location of the iteration range.
     */
    public constructor(
        tokens: Token[],
        _comments: Token[],
        indexMap: { [key: number]: number },
        startLoc: number,
        endLoc: number,
    ) {
        super()
        this.tokens = tokens
        this.index = getLastIndex(tokens, indexMap, endLoc)
        this.indexEnd = getFirstIndex(tokens, indexMap, startLoc)
    }

    /** @inheritdoc */
    public moveNext(): boolean {
        if (this.index >= this.indexEnd) {
            this.current = this.tokens[this.index]
            this.index -= 1
            return true
        }
        return false
    }

    //
    // Shorthand for performance.
    //

    /** @inheritdoc */
    public getOneToken(): Token | null {
        return this.index >= this.indexEnd ? this.tokens[this.index] : null
    }
}
