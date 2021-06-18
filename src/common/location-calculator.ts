/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import sortedLastIndex from "lodash/sortedLastIndex"
import type { HasLocation, Location, ParseError } from "../ast"
import { fixErrorLocation, fixLocation } from "./fix-locations"
import { LinesAndColumns } from "./lines-and-columns"

/**
 * Location calculators.
 */
export interface LocationCalculator {
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
export class LocationCalculatorForHtml
    extends LinesAndColumns
    implements LocationCalculator
{
    private gapOffsets: number[]
    private baseOffset: number
    private baseIndexOfGap: number
    private shiftOffset: number

    /**
     * Initialize this calculator.
     * @param gapOffsets The list of the offset of removed characters in tokenization phase.
     * @param ltOffsets The list of the offset of line terminators.
     * @param baseOffset The base offset to calculate locations.
     * @param shiftOffset The shift offset to calculate locations.
     */
    public constructor(
        gapOffsets: number[],
        ltOffsets: number[],
        baseOffset?: number,
        shiftOffset = 0,
    ) {
        super(ltOffsets)
        this.gapOffsets = gapOffsets
        this.ltOffsets = ltOffsets
        this.baseOffset = baseOffset || 0
        this.baseIndexOfGap =
            this.baseOffset === 0
                ? 0
                : sortedLastIndex(gapOffsets, this.baseOffset)
        this.shiftOffset = shiftOffset
    }

    /**
     * Get sub calculator which have the given base offset.
     * @param offset The base offset of new sub calculator.
     * @returns Sub calculator.
     */
    public getSubCalculatorAfter(offset: number): LocationCalculatorForHtml {
        return new LocationCalculatorForHtml(
            this.gapOffsets,
            this.ltOffsets,
            this.baseOffset + offset,
            this.shiftOffset,
        )
    }

    /**
     * Get sub calculator that shifts the given offset.
     * @param offset The shift of new sub calculator.
     * @returns Sub calculator.
     */
    public getSubCalculatorShift(offset: number): LocationCalculatorForHtml {
        return new LocationCalculatorForHtml(
            this.gapOffsets,
            this.ltOffsets,
            this.baseOffset,
            this.shiftOffset + offset,
        )
    }

    /**
     * Calculate gap at the given index.
     * @param index The index to calculate gap.
     */
    private _getGap(index: number): number {
        const offsets = this.gapOffsets
        let g0 = sortedLastIndex(offsets, index + this.baseOffset)
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
    public getLocation(index: number): Location {
        return this.getLocFromIndex(this.baseOffset + index + this.shiftOffset)
    }

    /**
     * Calculate the offset of the given index.
     * @param index The index to calculate their location.
     * @returns The offset of the index.
     */
    public getOffsetWithGap(index: number): number {
        const shiftOffset = this.shiftOffset
        return (
            this.baseOffset +
            index +
            shiftOffset +
            this._getGap(index + shiftOffset)
        )
    }

    /**
     * Modify the location information of the given node with using the base offset and gaps of this calculator.
     * @param node The node to modify their location.
     */
    public fixLocation<T extends HasLocation>(node: T): T {
        return fixLocation(node, this)
    }

    /**
     * Gets the fix location offset of the given offset with using the base offset of this calculator.
     * @param offset The offset to modify.
     */
    public getFixOffset(offset: number): number {
        const shiftOffset = this.shiftOffset
        const gap = this._getGap(offset + shiftOffset)
        return this.baseOffset + Math.max(0, gap) + shiftOffset
    }

    /**
     * Modify the location information of the given error with using the base offset and gaps of this calculator.
     * @param error The error to modify their location.
     */
    public fixErrorLocation(error: ParseError) {
        fixErrorLocation(error, this)
    }
}
