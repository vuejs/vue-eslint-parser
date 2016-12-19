/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const path = require("path")
const parse = require("./lib/parse")

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

/**
 * Gets the specified parser.
 * If it's unspecified, this returns espree.
 *
 * @param {object} options - The option object.
 * @param {string} [options.parser] - The parser name to get.
 * @returns {object} The gotten parser.
 */
function getParser(options) {
    return require(options.parser || "espree")
}

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

/**
 * Provides the `parse` method for `.vue` files.
 *
 * @module vue-eslint-parser
 */
module.exports = {
    /**
     * Parses the source code.
     *
     * If `options.filePath` is a `.vue` file, this extracts the first `<script>`
     * element then parses it.
     *
     * @param {string} text - The source code to be parsed.
     * @param {object} options - The option object for espree.
     * @returns {{ast: ASTNode}} The AST object as the result of parsing.
     */
    parse(text, options) {
        const parser = getParser(options)

        if (path.extname(options.filePath || "unknown.js") !== ".vue") {
            return parser.parse(text, options)
        }

        const script = parse(text)
        const ast = parser.parse(script.text, options)

        ast.start = script.offset
        if (script.startToken) {
            ast.tokens.unshift(script.startToken)
        }
        if (script.endToken) {
            ast.tokens.push(script.endToken)
        }

        return ast
    },
}
