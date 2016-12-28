/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const entities = require("entities")

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const NON_LT = /[^\r\n\u2028\u2029]/g
const SPACE = /\s/

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
     * @returns {ASTNode} The created AST node.
     */
    parseExpression(start, end) {
        const codeStart = this.getInlineScriptStart(start)
        const codeEnd = this.getInlineScriptEnd(end)
        if (codeStart >= codeEnd) {
            throw new Error(
                "Parsing error: Expected an expression " +
                "but got no code."
            )
        }

        const prefix = this.text.slice(0, codeStart - 1).replace(NON_LT, " ")
        const code = entities.decodeHTML(this.text.slice(codeStart, codeEnd))
        const ast = this._parseScript(`${prefix}(${code})`)

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

        return expression
    }
}

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

module.exports = ScriptParser
