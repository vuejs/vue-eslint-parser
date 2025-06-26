import type { ParseError, VDocumentFragment } from "../ast/index"
import { sortedIndexBy } from "../utils/utils"
/**
 * Insert the given error.
 * @param document The document that the node is belonging to.
 * @param error The error to insert.
 */
export function insertError(
    document: VDocumentFragment | null,
    error: ParseError,
): void {
    if (document == null) {
        return
    }

    const index = sortedIndexBy(document.errors, error, byIndex)
    document.errors.splice(index, 0, error)
}

/**
 * Get `x.pos`.
 * @param x The object to get.
 * @returns `x.pos`.
 */
function byIndex(x: ParseError): number {
    return x.index
}
