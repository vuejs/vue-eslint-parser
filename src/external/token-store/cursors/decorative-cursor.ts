/**
 * @fileoverview Define the abstract class about cursors which manipulate another cursor.
 * @author Toru Nagashima
 */
import Cursor from "./cursor"

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

/**
 * The abstract class about cursors which manipulate another cursor.
 */
export default class DecorativeCursor extends Cursor {
    protected cursor: Cursor

    /**
     * Initializes this cursor.
     * @param cursor - The cursor to be decorated.
     */
    constructor(cursor: Cursor) {
        super()
        this.cursor = cursor
    }

    /** @inheritdoc */
    moveNext(): boolean {
        const retv = this.cursor.moveNext()

        this.current = this.cursor.current

        return retv
    }
}
