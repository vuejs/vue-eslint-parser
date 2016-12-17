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
const SAXParser = require("parse5").SAXParser

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const LINE_TERMINATORS = /\r\n|\r|\n|\u2028|\u2029/g

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

/**
 * Calculates the end location.
 *
 * @param {string} raw - The text of the target token.
 * @param {number} startLine - The start line of the target token.
 * @param {number} startColumn - The start column of the target token.
 * @returns {{line: number, column: number}} The end location.
 * @private
 */
function calcLocEnd(raw, startLine, startColumn) {
    const lines = raw.split(LINE_TERMINATORS)
    const line = startLine + lines.length - 1
    const column = (lines.length === 1)
        ? startColumn + raw.length
        : lines[lines.length - 1].length

    return {line, column}
}

/**
 * Creates the token with the given parameters.
 *
 * @param {string} value - The token value to create.
 * @param {string} text - The whole text.
 * @param {object} location - The location object of `parse5` module.
 * @returns {object} The created token object.
 * @private
 */
function createToken(value, text, location) {
    const type = "Punctuator"
    const start = location.startOffset
    const end = location.endOffset
    const line = location.line
    const column = location.col - 1
    const range = [start, end]
    const raw = text.slice(start, end)
    const loc = {
        start: {line, column},
        end: calcLocEnd(raw, line, column),
    }

    return {type, value, raw, start, end, range, loc}
}

/**
 * Extracts the text of the 1st script element in the given text.
 *
 * @param {string} originalText - The whole text to extract.
 * @returns {{text: string, offset: number}} The information of the 1st script.
 * @private
 */
function extractFirstScript(originalText) {
    const parser = new SAXParser({locationInfo: true})
    let inTemplate = 0
    let startToken = null
    let endToken = null
    let text = ""
    let offset = 0

    parser.on("startTag", (name, attrs, selfClosing, location) => {
        if (selfClosing) {
            return
        }
        if (name === "template") {
            inTemplate += 1
        }
        if (inTemplate === 0 && name === "script") {
            startToken = createToken("<script>", originalText, location)
        }
    })
    parser.on("endTag", (name, location) => {
        if (inTemplate > 0 && name === "template") {
            inTemplate -= 1
        }
        if (startToken != null && name === "script") {
            endToken = createToken("</script>", originalText, location)
            parser.stop()
        }
    })
    parser.on("text", (_, location) => {
        if (startToken != null) {
            const start = location.startOffset
            const countLines = location.line - 1
            const lineTerminators = "\n".repeat(countLines)
            const spaces = " ".repeat(start - countLines)
            const scriptText = originalText.slice(start, location.endOffset)

            text = `${spaces}${lineTerminators}${scriptText}`
            offset = start
        }
    })
    parser.end(originalText)

    return {startToken, endToken, text, offset}
}

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

/**
 * Parses the source code.
 *
 * If `options.filePath` is a `.vue` file, this extracts the first `<script>`
 * element then parses it.
 *
 * @memberof module:vue-eslint-parser
 * @function parse
 * @param {string} text - The source code to be parsed.
 * @param {object} options - The option object for espree.
 * @returns {ASTNode} The AST object as the result of parsing.
 */
module.exports.parse = function parse(text, options) {
    const parser = getParser(options)

    if (path.extname(options.filePath || "unknown.js") !== ".vue") {
        return parser.parse(text, options)
    }

    const script = extractFirstScript(text)
    const ast = parser.parse(script.text, options)

    ast.start = script.offset
    if (script.startToken) {
        ast.tokens.unshift(script.startToken)
    }
    if (script.endToken) {
        ast.tokens.push(script.endToken)
    }

    return ast
}
