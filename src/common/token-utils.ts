import { sortedIndexBy, sortedLastIndexBy } from "../utils/utils"
import type { LocationRange, Token, VDocumentFragment } from "../ast/index"
import type { LinesAndColumns } from "./lines-and-columns"

interface HasRange {
    range: [number, number]
}
/**
 * Replace the tokens in the given range.
 * @param document The document that the node is belonging to.
 * @param node The node to specify the range of replacement.
 * @param newTokens The new tokens.
 */
export function replaceTokens(
    document: VDocumentFragment | null,
    node: HasRange,
    newTokens: Token[],
): void {
    if (document == null) {
        return
    }

    const index = sortedIndexBy(document.tokens, node, byRange0)
    const count = sortedLastIndexBy(document.tokens, node, byRange1) - index
    document.tokens.splice(index, count, ...newTokens)
}

/**
 * Replace and split the tokens in the given range.
 * @param document The document that the node is belonging to.
 * @param node The node to specify the range of replacement.
 * @param newTokens The new tokens.
 */
export function replaceAndSplitTokens(
    document: VDocumentFragment | null,
    node: HasRange & {
        loc: LocationRange
    },
    newTokens: Token[],
): void {
    if (document == null) {
        return
    }

    const index = sortedIndexBy(document.tokens, node, byRange0)
    if (
        document.tokens.length === index ||
        node.range[0] < document.tokens[index].range[0]
    ) {
        // split
        const beforeToken = document.tokens[index - 1]
        const value = beforeToken.value
        const splitOffset = node.range[0] - beforeToken.range[0]
        const afterToken: Token = {
            type: beforeToken.type,
            range: [node.range[0], beforeToken.range[1]],
            loc: {
                start: { ...node.loc.start },
                end: { ...beforeToken.loc.end },
            },
            value: value.slice(splitOffset),
        }
        beforeToken.range[1] = node.range[0]
        beforeToken.loc.end = { ...node.loc.start }
        beforeToken.value = value.slice(0, splitOffset)
        document.tokens.splice(index, 0, afterToken)
    }
    let lastIndex = sortedLastIndexBy(document.tokens, node, byRange1)
    if (
        lastIndex === 0 ||
        node.range[1] < document.tokens[lastIndex].range[1]
    ) {
        // split
        const beforeToken = document.tokens[lastIndex]
        const value = beforeToken.value
        const splitOffset =
            beforeToken.range[1] -
            beforeToken.range[0] -
            (beforeToken.range[1] - node.range[1])
        const afterToken: Token = {
            type: beforeToken.type,
            range: [node.range[1], beforeToken.range[1]],
            loc: {
                start: { ...node.loc.end },
                end: { ...beforeToken.loc.end },
            },
            value: value.slice(splitOffset),
        }
        beforeToken.range[1] = node.range[1]
        beforeToken.loc.end = { ...node.loc.end }
        beforeToken.value = value.slice(0, splitOffset)
        document.tokens.splice(lastIndex + 1, 0, afterToken)
        lastIndex++
    }
    const count = lastIndex - index
    document.tokens.splice(index, count, ...newTokens)
}

/**
 * Insert the given comment tokens.
 * @param document The document that the node is belonging to.
 * @param newComments The comments to insert.
 */
export function insertComments(
    document: VDocumentFragment | null,
    newComments: Token[],
): void {
    if (document == null || newComments.length === 0) {
        return
    }

    const index = sortedIndexBy(document.comments, newComments[0], byRange0)
    document.comments.splice(index, 0, ...newComments)
}

/**
 * Create a simple token.
 * @param type The type of new token.
 * @param start The offset of the start position of new token.
 * @param end The offset of the end position of new token.
 * @param value The value of new token.
 * @returns The new token.
 */
export function createSimpleToken(
    type: string,
    start: number,
    end: number,
    value: string,
    linesAndColumns: LinesAndColumns,
): Token {
    return {
        type,
        range: [start, end],
        loc: {
            start: linesAndColumns.getLocFromIndex(start),
            end: linesAndColumns.getLocFromIndex(end),
        },
        value,
    }
}

/**
 * Get `x.range[0]`.
 * @param x The object to get.
 * @returns `x.range[0]`.
 */
function byRange0(x: HasRange): number {
    return x.range[0]
}

/**
 * Get `x.range[1]`.
 * @param x The object to get.
 * @returns `x.range[1]`.
 */
function byRange1(x: HasRange): number {
    return x.range[1]
}
