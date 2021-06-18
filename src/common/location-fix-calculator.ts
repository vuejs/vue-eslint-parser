import type { Location } from "../ast"
import type { LinesAndColumns } from "./lines-and-columns"
export interface LocationFixCalculator {
    /**
     * Gets the fix location offset of the given offset with using the base offset of this calculator.
     * @param offset The offset to modify.
     */
    getFixOffset(offset: number, kind: "start" | "end"): number

    /**
     * Calculate the location of the given index.
     * @param index The index to calculate their location.
     * @returns The location of the index.
     */
    getLocFromIndex(index: number): Location
}

export function simpleOffsetLocationFixCalculator(
    offset: number,
    linesAndColumns: LinesAndColumns,
): LocationFixCalculator {
    return {
        getFixOffset() {
            return offset
        },
        getLocFromIndex: linesAndColumns.getLocFromIndex.bind(linesAndColumns),
    }
}
