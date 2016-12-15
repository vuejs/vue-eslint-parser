/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const espree = require("espree")
const SAXParser = require("parse5").SAXParser

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

/**
 * Extracts the text of the 1st script element in the given text.
 *
 * @param {string} originalText - The whole text to extract.
 * @returns {{text: string, offset: number}} The information of the 1st script.
 */
function extractFirstScript(originalText) {
    const parser = new SAXParser({locationInfo: true})
    let inScript = false
    let text = ""
    let offset = 0

    parser.on("startTag", (name, attrs, selfClosing) => {
        if (name === "script" && !selfClosing) {
            inScript = true
        }
    })
    parser.on("endTag", (name) => {
        if (name === "script") {
            inScript = false
        }
    })
    parser.on("text", (scriptText, location) => {
        if (inScript && text === "") {
            const lineTerminators = "\n".repeat(location.line - 1)
            const spaces = " ".repeat(location.startOffset - location.line + 1)
            text = `${spaces}${lineTerminators}${scriptText}`
            offset = location.startOffset
        }
    })
    parser.end(originalText)

    return {text, offset}
}

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

module.exports.parse = function parse(text, options) {
    const script = extractFirstScript(text)
    const ast = espree.parse(script.text, options)

    ast.start = script.offset

    return ast
}
