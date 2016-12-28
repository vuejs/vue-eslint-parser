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
const registerTemplateBodyVisitor = require("./register-template-body-visitor")
const ScriptParser = require("./script-parser")
const TokenGenerator = require("./token-generator")
const transformHtml = require("./transform-html")

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

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
 * Parse the script node with the script parser that options specified.
 *
 * @param {module:parse5.AST.Node} scriptNode - The script node to be parsed.
 * @param {ScriptParser} scriptParser - The script parser.
 * @param {TokenGenerator} tokenGenerator - The token generator.
 * @returns {ASTNode} The result of parsing.
 */
function parseScriptNode(scriptNode, scriptParser, tokenGenerator) {
    const location = scriptNode.__location
    const startLoc = location.startTag
    const endLoc = location.endTag

    if (startLoc == null || endLoc == null) {
        return scriptParser._parseScript("")
    }
    const start = startLoc.endOffset
    const end = endLoc.startOffset
    const ast = scriptParser.parseScript(start, end)

    // Needs the tokens of start/end tags for `lines-around-*` rules to work
    // correctly.
    const startTag = tokenGenerator.createToken(
        "Punctuator",
        startLoc.startOffset,
        startLoc.endOffset
    )
    const endTag = tokenGenerator.createToken(
        "Punctuator",
        endLoc.startOffset,
        endLoc.endOffset
    )
    ast.start = startTag.end
    ast.tokens.unshift(startTag)
    ast.tokens.push(endTag)

    return ast
}

/**
 * Transform the given `<template>` node to ESTree-like AST.
 * @param {module:parse5.AST.Node} templateNode The `<template>` element node to parse.
 * @param {ScriptParser} scriptParser - The script parser.
 * @param {TokenGenerator} tokenGenerator - The token generator.
 * @param {object} templateOptions - The options.
 * @returns {ASTNode} The transformation result.
 */
function parseTemplateNode(templateNode, scriptParser, tokenGenerator, templateOptions) {
    const langAttr = templateNode.attrs.find(attr => attr.name === "lang")
    const lang = (langAttr && langAttr.value) || "html"

    switch (lang) {
        case "html":
            return transformHtml(
                templateNode,
                scriptParser,
                tokenGenerator,
                templateOptions
            )
        default:
            return null
    }
}

/**
 * Parse the .vue code with the parsers that options specified.
 *
 * @param {string} code - The .vue code to parse.
 * @param {object} options - The options to parse.
 * @returns {ASTNoe} The result of parsing.
 */
function parse(code, options) {
    const filePath = options.filePath
    const scriptOptions = options
    const templateOptions = options.template || {}
    const isVue = path.extname(filePath || "unknown.js") === ".vue"
    const scriptParser = new ScriptParser(code, scriptOptions)

    if (!isVue) {
        return {
            ast: scriptParser._parseScript(code),
            services: {registerTemplateBodyVisitor},
        }
    }
    const info = parseComponent(code)
    if (!info.script) {
        return {
            ast: scriptParser._parseScript(""),
            services: {registerTemplateBodyVisitor},
        }
    }

    const tokenGenerator = new TokenGenerator(code)
    const ast = parseScriptNode(
        info.script,
        scriptParser,
        tokenGenerator
    )
    ast.templateBody = info.template && parseTemplateNode(
        info.template,
        scriptParser,
        tokenGenerator,
        templateOptions
    )

    return {
        ast,
        services: {registerTemplateBodyVisitor},
    }
}

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

module.exports = parse
