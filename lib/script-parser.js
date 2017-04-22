/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const sortedIndexBy = require("lodash.sortedindexby")
const decodeHtmlEntities = require("./decode-html-entities")
const traverseNodes = require("./traverse-nodes")

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const NON_LT = /[^\r\n\u2028\u2029]/g
const SPACE = /\s/

/**
 * Get the 1st element of the given array.
 * @param {any[]} item The array to get.
 * @returns {any} The 1st element.
 */
function first(item) {
    return item[0]
}

/**
 * Fix the range of location of the given node.
 * This will expand ranges because those have shrunk by decoding HTML entities.
 * @param {ASTNode} node The node to fix range and location.
 * @param {TokenGenerator} tokenGenerator The token generator to re-calculate locations.
 * @param {(number[])[]} gaps The gap array to re-calculate ranges.
 * @param {number} codeStart The start offset of this expression.
 * @returns {void}
 */
function fixRangeAndLocByGap(node, tokenGenerator, gaps, codeStart) {
    const range = node.range
    const loc = node.loc
    const start = range[0] - codeStart
    const end = range[1] - codeStart

    let i = sortedIndexBy(gaps, [start], first) - 1
    if (i >= 0) {
        range[0] += (i + 1 < gaps.length && gaps[i + 1][0] === start)
            ? gaps[i + 1][1]
            : gaps[i][1]
        loc.start = tokenGenerator.getLocPart(range[0])
    }
    i = sortedIndexBy(gaps, [end], first) - 1
    if (i >= 0) {
        range[1] += (i + 1 < gaps.length && gaps[i + 1][0] === end)
            ? gaps[i + 1][1]
            : gaps[i][1]
        loc.end = tokenGenerator.getLocPart(range[1])
    }
}

/**
 * Do post-process of parsing an expression.
 *
 * 1. Set `node.parent`.
 * 2. Fix `node.range` and `node.loc` for HTML entities.
 *
 * @param {ASTNode} ast The AST root node to initialize.
 * @param {TokenGenerator} tokenGenerator The token generator to calculate locations.
 * @param {(number[])[]} gaps The gaps to re-calculate locations.
 * @param {number} codeStart The start offset of the expression.
 * @returns {void}
 */
function postprocess(ast, tokenGenerator, gaps, codeStart) {
    const gapsExist = gaps.length >= 1

    traverseNodes(ast, {
        enterNode(node, parent) {
            node.parent = parent
            if (gapsExist) {
                fixRangeAndLocByGap(node, tokenGenerator, gaps, codeStart)
            }
        },
        leaveNode() {
            // Do nothing.
        },
    })

    if (gapsExist) {
        for (const token of ast.tokens) {
            fixRangeAndLocByGap(token, tokenGenerator, gaps, codeStart)
        }
        for (const comment of ast.comments) {
            fixRangeAndLocByGap(comment, tokenGenerator, gaps, codeStart)
        }
    }
}

/**
 * The script parser.
 */
class ScriptParser {
    /**
     * Initialize this parser.
     * @param {string} text The whole source code.
     * @param {object} options The parser options.
     */
    constructor(text, options) {
        this.text = text
        this.options = options
        this.impl = require(options.parser || "espree")
    }

    /**
     * Get the offset at the 1st valid characters after the given offset.
     * @param {number} offset The offset to get.
     * @returns {number} The 1st valid characters after the given offset.
     */
    getInlineScriptStart(offset) {
        let i = offset
        while (SPACE.test(this.text[i])) {
            i += 1
        }
        return i
    }

    /**
     * Get the offset at the 1st valid characters before the given offset.
     * @param {number} offset The offset to get.
     * @returns {number} The 1st valid characters before the given offset.
     */
    getInlineScriptEnd(offset) {
        let i = offset - 1
        while (SPACE.test(this.text[i])) {
            i -= 1
        }
        return i + 1
    }

    /**
     * Parse the source code with the script parser that options specified.
     *
     * @param {string} code - The source code to be parsed.
     * @returns {ASTNode} The result of parsing.
     */
    _parseScript(code) {
        const result = (typeof this.impl.parseForESLint === "function")
            ? this.impl.parseForESLint(code, this.options)
            : this.impl.parse(code, this.options)

        if (typeof result.ast === "object") {
            return result.ast
        }
        return result
    }

    /**
     * Parse the script which is on the given range.
     * @param {number} start The start offset to parse.
     * @param {number} end The end offset to parse.
     * @returns {ASTNode} The created AST node.
     */
    parseScript(start, end) {
        if (start >= end) {
            return this._parseScript("")
        }

        const prefix = this.text.slice(0, start).replace(NON_LT, " ")
        const code = this.text.slice(start, end)
        return this._parseScript(`${prefix}${code}`)
    }

    /**
     * Parse the script which is on the given range.
     * @param {number} start The start offset to parse.
     * @param {number} end The end offset to parse.
     * @param {TokenGenerator} tokenGenerator The token generator to fix loc.
     * @returns {ASTNode} The created AST node.
     */
    parseExpression(start, end, tokenGenerator) {
        const codeStart = this.getInlineScriptStart(start)
        const codeEnd = this.getInlineScriptEnd(end)
        if (codeStart >= codeEnd) {
            throw new Error(
                "Parsing error: Expected an expression " +
                "but got no code."
            )
        }

        const prefix = this.text.slice(0, codeStart - 1).replace(NON_LT, " ")
        const code = this.text.slice(codeStart, codeEnd)
        const gaps = []
        const decodedCode = decodeHtmlEntities(code, gaps)
        const ast = this._parseScript(`${prefix}(${decodedCode})`)

        if (ast.body.length === 0) {
            throw new Error(
                "Parsing error: Expected an expression " +
                "but got no code."
            )
        }
        if (ast.body.length >= 2) {
            throw new Error(
                "Parsing error: Expected an expression " +
                "but got multiple statements."
            )
        }

        const expression = ast.body[0].expression
        expression.tokens = ast.tokens || []
        expression.comments = ast.comments || []
        expression.tokens.shift()
        expression.tokens.pop()

        postprocess(expression, tokenGenerator, gaps, codeStart)

        return expression
    }
}

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

module.exports = ScriptParser
