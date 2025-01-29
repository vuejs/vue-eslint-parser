/**
 * @fileoverview Define the cursor which ignores specified tokens.
 * @author Toru Nagashima
 */
import type { Token } from "../../../ast/index"
import type Cursor from "./cursor"
import DecorativeCursor from "./decorative-cursor"

/**
 * The decorative cursor which ignores specified tokens.
 */
export default class FilterCursor extends DecorativeCursor {
    private predicate: (token: Token) => boolean

    /**
     * Initializes this cursor.
     * @param cursor - The cursor to be decorated.
     * @param predicate - The predicate function to decide tokens this cursor iterates.
     */
    public constructor(cursor: Cursor, predicate: (token: Token) => boolean) {
        super(cursor)
        this.predicate = predicate
    }

    /** @inheritdoc */
    public moveNext(): boolean {
        const predicate = this.predicate

        while (super.moveNext()) {
            if (predicate(this.current as Token)) {
                return true
            }
        }
        return false
    }
}
