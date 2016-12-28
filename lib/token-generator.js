/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const sortedIndex = require("lodash.sortedindex")

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const LT = /(?:\r\n|[\r\n\u2028\u2029])/g

/**
 * Create the array of the offsets of line headings.
 * @param {string} text The text to detect line headings.
 * @returns {number[]} The offsets of line headings.
 */
function getHeadOffsets(text) {
    const retv = []
    let match = null

    LT.lastIndex = 0
    while ((match = LT.exec(text)) != null) {
        retv.push(match.index + match[0].length)
    }

    return retv
}

/**
 * Token generator.
 */
class TokenGenerator {
    /**
     * Initialize this token generator.
     * @param {string} text The whole source code text.
     */
    constructor(text) {
        this.text = text
        this.headOffsets = getHeadOffsets(text)
    }

    /**
     * Get line/column pair of the given offset.
     * @param {number} offset The offset to get line/column pair.
     * @returns {{line: number, column: number}} line/column pair.
     */
    getLocPart(offset) {
        const line = 1 + sortedIndex(this.headOffsets, offset + 1)
        const column = offset - (line === 1 ? 0 : this.headOffsets[line - 2])

        return {line, column}
    }

    /**
     * Get the pair of line/column pair of the given offsets.
     * @param {number} start The start offset to get line/column pair.
     * @param {number} end The end offset to get line/column pair.
     * @returns {{start:{line: number, column: number}, end:{line: number, column: number}}} The pair of line/column pair.
     */
    getLoc(start, end) {
        return {
            start: this.getLocPart(start),
            end: this.getLocPart(end),
        }
    }

    /**
     * Create new token.
     * @param {string} type The type of this token to create.
     * @param {number} start The start offset of this token.
     * @param {number} end The end offset of this token.
     * @returns {ASTNode} The created token.
     */
    createToken(type, start, end) {
        return {
            type,
            range: [start, end],
            loc: this.getLoc(start, end),
            value: this.text.slice(start, end),
        }
    }
}

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

module.exports = TokenGenerator
