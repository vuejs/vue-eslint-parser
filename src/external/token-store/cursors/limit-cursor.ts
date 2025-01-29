/**
 * @fileoverview Define the cursor which limits the number of tokens.
 * @author Toru Nagashima
 */
import type Cursor from "./cursor"
import DecorativeCursor from "./decorative-cursor"

/**
 * The decorative cursor which limits the number of tokens.
 */
export default class LimitCursor extends DecorativeCursor {
    private count: number

    /**
     * Initializes this cursor.
     * @param cursor - The cursor to be decorated.
     * @param count - The count of tokens this cursor iterates.
     */
    public constructor(cursor: Cursor, count: number) {
        super(cursor)
        this.count = count
    }

    /** @inheritdoc */
    public moveNext(): boolean {
        if (this.count > 0) {
            this.count -= 1
            return super.moveNext()
        }
        return false
    }
}
