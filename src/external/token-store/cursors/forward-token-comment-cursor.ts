/**
 * @fileoverview Define the cursor which iterates tokens and comments.
 * @author Toru Nagashima
 */
import type { Token } from "../../../ast/index"
import { getFirstIndex, search } from "../utils"
import Cursor from "./cursor"

/**
 * The cursor which iterates tokens and comments.
 */
export default class ForwardTokenCommentCursor extends Cursor {
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
    public constructor(
        tokens: Token[],
        comments: Token[],
        indexMap: { [key: number]: number },
        startLoc: number,
        endLoc: number,
    ) {
        super()
        this.tokens = tokens
        this.comments = comments
        this.tokenIndex = getFirstIndex(tokens, indexMap, startLoc)
        this.commentIndex = search(comments, startLoc)
        this.border = endLoc
    }

    /** @inheritdoc */
    public moveNext(): boolean {
        const token =
            this.tokenIndex < this.tokens.length
                ? this.tokens[this.tokenIndex]
                : null
        const comment =
            this.commentIndex < this.comments.length
                ? this.comments[this.commentIndex]
                : null

        if (token && (!comment || token.range[0] < comment.range[0])) {
            this.current = token
            this.tokenIndex += 1
        } else if (comment) {
            this.current = comment
            this.commentIndex += 1
        } else {
            this.current = null
        }

        return (
            this.current != null &&
            (this.border === -1 || this.current.range[1] <= this.border)
        )
    }
}
