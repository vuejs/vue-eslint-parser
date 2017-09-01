/**
 * @fileoverview Define the cursor which ignores the first few tokens.
 * @author Toru Nagashima
 */
import Cursor from "./cursor"
import DecorativeCursor from "./decorative-cursor"

/**
 * The decorative cursor which ignores the first few tokens.
 */
export default class SkipCursor extends DecorativeCursor {
    private count: number

    /**
     * Initializes this cursor.
     * @param cursor - The cursor to be decorated.
     * @param count - The count of tokens this cursor skips.
     */
    constructor(cursor: Cursor, count: number) {
        super(cursor)
        this.count = count
    }

    /** @inheritdoc */
    moveNext(): boolean {
        while (this.count > 0) {
            this.count -= 1
            if (!super.moveNext()) {
                return false
            }
        }
        return super.moveNext()
    }
}
