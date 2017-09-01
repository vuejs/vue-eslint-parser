/**
 * @fileoverview Define the cursor which iterates tokens and comments in reverse.
 * @author Toru Nagashima
 */
import {Token} from "../../../ast"
import {getLastIndex, search} from "../utils"
import Cursor from "./cursor"

/**
 * The cursor which iterates tokens and comments in reverse.
 */
export default class BackwardTokenCommentCursor extends Cursor {
    private tokens: Token[]
    private comments: Token[]
    private tokenIndex: number
    private commentIndex: number
    private border: number

    /**
     * Initializes this cursor.
     * @param tokens - The array of tokens.
     * @param comments - The array of comments.
     * @param indexMap - The map from locations to indices in `tokens`.
     * @param startLoc - The start location of the iteration range.
     * @param endLoc - The end location of the iteration range.
     */
    constructor(tokens: Token[], comments: Token[], indexMap: { [key: number]: number }, startLoc: number, endLoc: number) {
        super()
        this.tokens = tokens
        this.comments = comments
        this.tokenIndex = getLastIndex(tokens, indexMap, endLoc)
        this.commentIndex = search(comments, endLoc) - 1
        this.border = startLoc
    }

    /** @inheritdoc */
    moveNext(): boolean {
        const token = (this.tokenIndex >= 0) ? this.tokens[this.tokenIndex] : null
        const comment = (this.commentIndex >= 0) ? this.comments[this.commentIndex] : null

        if (token && (!comment || token.range[1] > comment.range[1])) {
            this.current = token
            this.tokenIndex -= 1
        }
        else if (comment) {
            this.current = comment
            this.commentIndex -= 1
        }
        else {
            this.current = null
        }

        return this.current != null && (this.border === -1 || this.current.range[0] >= this.border)
    }
}
