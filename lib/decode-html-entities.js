/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const entities = require("./entities.json")

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const ENTITY_PATTERN = /&(#?[\w\d]+);?/g

/**
 * Replace all HTML entities.
 * @param {string} source The string to replace.
 * @param {(number[])[]} gaps The gap array. This is output.
 * This is the array of tuples which have 2 elements. The 1st element is the
 * offset of the location that gap was changed. The 2nd element is the gap size.
 * For example, in `a &amp;&amp; b` case, it's `[ [ 3, 4 ], [ 4, 8 ] ]`.
 * @returns {string} The replaced string.
 */
function decodeHtmlEntities(source, gaps) {
    let result = ""
    let match = null
    let lastIndex = 0
    let gap = 0

    ENTITY_PATTERN.lastIndex = 0
    while ((match = ENTITY_PATTERN.exec(source)) != null) {
        const whole = match[0]
        const s = match[1]
        let c = ""

        if (s[0] === "#") {
            const code = s[1] === "x" ?
                parseInt(s.slice(2).toLowerCase(), 16) :
                parseInt(s.slice(1), 10)

            if (!(isNaN(code) || code < -32768 || code > 65535)) {
                c = String.fromCharCode(code)
            }
        }
        c = entities[s] || whole

        result += source.slice(lastIndex, match.index)
        result += c
        lastIndex = match.index + whole.length
        if (whole.length !== c.length) {
            gap += (whole.length - c.length)
            gaps.push([result.length, gap])
        }
    }
    result += source.slice(lastIndex)

    return result
}

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

module.exports = decodeHtmlEntities
