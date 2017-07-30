/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import * as lodash from "lodash"
import {HasLocation, Location, ParseError} from "../ast"

/**
 * Location calculators.
 * 
 * HTML tokenizers remove several characters to handle HTML entities and line terminators.
 * Tokens have the processed text as their value, but tokens have offsets and locations in the original text.
 * This calculator calculates the original locations from the processed texts.
 * 
 * This calculator will be used for:
 * 
 * - Adjusts the locations of script ASTs.
 * - Creates expression containers in postprocess.
 */
export class LocationCalculator {
    private gapOffsets: number[]
    private ltOffsets: number[]
    private baseOffset: number
    private baseIndexOfGap: number

    /**
     * Initialize this calculator.
     * @param gapOffsets The list of the offset of removed characters in tokenization phase.
     * @param ltOffsets The list of the offset of line terminators.
     * @param baseOffset The base offset to calculate locations.
     */
    constructor(gapOffsets: number[], ltOffsets: number[], baseOffset?: number) {
        this.gapOffsets = gapOffsets
        this.ltOffsets = ltOffsets
        this.baseOffset = baseOffset || 0
        this.baseIndexOfGap = (this.baseOffset === 0)
            ? 0
            : lodash.sortedLastIndex(gapOffsets, this.baseOffset)
    }

    /**
     * Get sub calculator which have the given base offset.
     * @param offset The base offset of new sub calculator.
     * @returns Sub calculator.
     */
    getSubCalculatorAfter(offset: number): LocationCalculator {
        return new LocationCalculator(
            this.gapOffsets,
            this.ltOffsets,
            this.baseOffset + offset
        )
    }

    /**
     * Calculate the location of the given offset.
     * @param offset The offset to calculate their location.
     * @returns The location of the offset.
     */
    private _getLocation(offset: number): Location {
        const line = lodash.sortedLastIndex(this.ltOffsets, offset) + 1
        const column = offset - (line === 1 ? 0 : this.ltOffsets[line - 2])
        return {line, column}
    }

    /**
     * Calculate gap at the given index.
     * @param index The index to calculate gap.
     */
    private _getGap(index: number): number {
        const offsets = this.gapOffsets
        let g0 = lodash.sortedLastIndex(offsets, index + this.baseOffset)
        let pos = index + this.baseOffset + g0 - this.baseIndexOfGap

        while (g0 < offsets.length && offsets[g0] <= pos) {
            g0 += 1
            pos += 1
        }

        return g0 - this.baseIndexOfGap
    }

    /**
     * Calculate the location of the given index.
     * @param index The index to calculate their location.
     * @returns The location of the index.
     */
    getLocation(index: number): Location {
        return this._getLocation(this.baseOffset + index)
    }

    /**
     * Calculate the offset of the given index.
     * @param index The index to calculate their location.
     * @returns The offset of the index.
     */
    getOffsetWithGap(index: number): number {
        return this.baseOffset + index + this._getGap(index)
    }

    /**
     * Modify the location information of the given node with using the base offset and gaps of this calculator.
     * @param node The node to modify their location.
     */
    fixLocation(node: HasLocation): void {
        const range = node.range
        const loc = node.loc
        const gap0 = this._getGap(range[0])
        const gap1 = this._getGap(range[1])
        const d0 = this.baseOffset + Math.max(0, gap0)
        const d1 = this.baseOffset + Math.max(0, gap1)

        if (d0 !== 0) {
            range[0] += d0
            if (node.start != null) {
                node.start += d0
            }
            loc.start = this._getLocation(range[0])
        }
        if (d1 !== 0) {
            range[1] += d1
            if (node.end != null) {
                node.end += d0
            }
            loc.end = this._getLocation(range[1])
        }
    }

    /**
     * Modify the location information of the given error with using the base offset and gaps of this calculator.
     * @param error The error to modify their location.
     */
    fixErrorLocation(error: ParseError) {
        const gap = this._getGap(error.index)
        const diff = this.baseOffset + Math.max(0, gap)

        error.index += diff

        const loc = this._getLocation(error.index)
        error.lineNumber = loc.line
        error.column = loc.column
    }
}
