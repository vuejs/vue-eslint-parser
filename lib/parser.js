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
const html = require("parse5")

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const LINE_TERMINATORS = /\r\n|\r|\n|\u2028|\u2029/g

/**
 * Parse the given component.
 *
 * Returned value contains the following things.
 *
 * - `script` is the information of the 1st `<script>` element.
 * - `template` is the information of the 1st `<template>` element.
 * - `styles` is the information of `<style>` elements.
 *
 * @param {string} code - The whole text to extract.
 * @returns {object} The information of the given component.
 * @private
 */
function parseComponent(code) {
    const fragment = html.parseFragment(code, {locationInfo: true})
    const result = {
        script: null,
        styles: [],
        template: null,
    }

    for (const childNode of fragment.childNodes) {
        switch (childNode.nodeName) {
            case "script":
                result.script = result.script || childNode
                break
            case "style":
                result.styles.push(childNode)
                break
            case "template":
                result.template = result.template || childNode
                break

            // no default
        }
    }

    return result
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
 * @param {string} code - The whole code.
 * @param {object} location - The location object of `parse5` module.
 * @returns {object} The created token object.
 * @private
 */
function createToken(value, code, location) {
    if (location == null) {
        return null
    }
    const type = "Punctuator"
    const start = location.startOffset
    const end = location.endOffset
    const line = location.line
    const column = location.col - 1
    const range = [start, end]
    const raw = code.slice(start, end)
    const loc = {
        start: {line, column},
        end: calcLocEnd(raw, line, column),
    }

    return {type, value, raw, start, end, range, loc}
}

/**
 * Get the source code of the given script node.
 *
 * @param {string} code - The whole source code of the component.
 * @param {Node} scriptNode - The script node to get.
 * @returns {string} The source code of the node.
 */
function getScriptCode(code, scriptNode) {
    if (scriptNode == null) {
        return ""
    }

    const textNode = scriptNode.childNodes[0]
    const textLocation = textNode && textNode.__location
    if (textLocation == null) {
        return ""
    }

    const start = textLocation.startOffset
    const countLines = textLocation.line - 1
    const lineTerminators = "\n".repeat(countLines)
    const spaces = " ".repeat(start - countLines)
    const scriptText = code.slice(start, textLocation.endOffset)

    return `${spaces}${lineTerminators}${scriptText}`
}

/**
 * The type of normalized options.
 */
class Parser {
    /**
     * @param {object} options - An options object.
     */
    constructor(options) {
        this.filePath = options.filePath
        this.scriptOptions = options
        this.styleOptions = options.style || {}
        this.templateOptions = options.template || {}
        this.scriptParser = require(this.scriptOptions.parser || "espree")
    }

    /**
     * The flag to indicate whether this is a Vue component or not.
     * @type {boolean}
     */
    get isVueComponent() {
        return path.extname(this.filePath || "unknown.js") === ".vue"
    }

    /**
     * Parse the source code with the script parser that options specified.
     *
     * @param {string} code - The source code to be parsed.
     * @returns {{ast: ASTNode, services: any}} The result of parsing.
     */
    parseScript(code) {
        const result = (typeof this.scriptParser.parseForESLint === "function")
            ? this.scriptParser.parseForESLint(code, this.scriptOptions)
            : this.scriptParser.parse(code, this.scriptOptions)

        if (typeof result.ast === "object") {
            return {
                ast: result.ast,
                services: result.services || {},
            }
        }
        return {ast: result, services: {}}
    }

    /**
     * Parse the script node with the script parser that options specified.
     *
     * @param {string} code - The whole source code of the component.
     * @param {Node} scriptNode - The script node to be parsed.
     * @returns {{ast: ASTNode, services: any}} The result of parsing.
     */
    parseScriptNode(code, scriptNode) {
        const scriptCode = getScriptCode(code, scriptNode)
        const result = this.parseScript(scriptCode)

        // Needs the tokens of start/end tags for `lines-around-*` rules to work
        // correctly.
        if (scriptNode != null) {
            const location = scriptNode.__location
            const startTag = createToken("<script>", code, location.startTag)
            const endTag = createToken("</script>", code, location.endTag)

            if (startTag != null) {
                result.ast.start = startTag.end
                result.ast.tokens.unshift(startTag)
            }
            if (endTag != null) {
                result.ast.tokens.push(endTag)
            }
        }

        return result
    }

    /**
     * Parse the .vue code with the parsers that options specified.
     *
     * @param {string} code - The .vue code to be parsed.
     * @returns {{ast: ASTNode, services: any}} The result of parsing.
     */
    parseComponent(code) {
        if (!this.isVueComponent) {
            return this.parseScript(code)
        }

        const info = parseComponent(code)
        const result = this.parseScriptNode(code, info.script)

        return result
    }
}

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

module.exports = Parser
