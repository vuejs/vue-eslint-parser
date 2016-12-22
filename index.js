/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const Parser = require("./lib/parser")

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
     * @param {string} code - The source code to be parsed.
     * @param {object} options - The option object.
     * @returns {{ast: ASTNode, services: any}} The result of parsing.
     */
    parse(code, options) {
        const parser = new Parser(options)
        return parser.parseComponent(code)
    },
}
