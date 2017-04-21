/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const debug = require("debug")("vue-eslint-parser")

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const MUSTACHE = /\{\{.+?}}/g
const DIRECTIVE_NAME = /^(?:v-|[:@]).+[^.:@]$/
const QUOTES = /^["']$/
const SPACE = /\s/

// 'u' flag has not supported in Node v4.
// https://html.spec.whatwg.org/#attributes-2
const INVALID_CHARS = /[\u0000-\u001F\u007F-\u009F\u0020\u0022\u0027\u003E\u002F\u003D\uFDD0-\uFDEF\uFFFE\uFFFF]/
const INVALID_PAIRS = new Set("\u{1FFFE}\u{1FFFF}\u{2FFFE}\u{2FFFF}\u{3FFFE}\u{3FFFF}\u{4FFFE}\u{4FFFF}\u{5FFFE}\u{5FFFF}\u{6FFFE}\u{6FFFF}\u{7FFFE}\u{7FFFF}\u{8FFFE}\u{8FFFF}\u{9FFFE}\u{9FFFF}\u{AFFFE}\u{AFFFF}\u{BFFFE}\u{BFFFF}\u{CFFFE}\u{CFFFF}\u{DFFFE}\u{DFFFF}\u{EFFFE}\u{EFFFF}\u{FFFFE}\u{FFFFF}\u{10FFFE}\u{10FFFF}")

/**
 * The transformer of HTML AST.
 * Input is the AST of `parse5` package.
 * Output is ESTree-like AST.
 */
class HTMLTransformer {
    /**
     * Transform the given parse5's AST to ESTree-like AST.
     * @param {module:parse5.AST.Node} ast The template element to transform.
     * @param {ScriptParser} scriptParser The script parser.
     * @param {TokenGenerator} tokenGenerator - The token generator.
     * @param {object} options The option to transform.
     * @returns {ASTNode} The transformation result.
     */
    static transform(ast, scriptParser, tokenGenerator, options) {
        const transformer = new HTMLTransformer(
            scriptParser,
            tokenGenerator,
            options
        )
        const transformed = transformer.visit(ast)

        transformed.tokens = transformer.tokens
        transformed.comments = transformer.comments

        return transformed
    }

    /**
     * Initialize this transformer.
     * @param {ScriptParser} scriptParser The script parser.
     * @param {TokenGenerator} tokenGenerator - The token generator.
     * @param {object} options The options to transform. Nothing for now.
     */
    constructor(scriptParser, tokenGenerator, options) {
        this.text = scriptParser.text
        this.scriptParser = scriptParser
        this.tokenGenerator = tokenGenerator
        this.options = options || {}
        this.tokens = []
        this.comments = []
    }

    /**
     * Get the pair of line/column pair of the given offsets.
     * @param {number} start The start offset to get line/column pair.
     * @param {number} end The end offset to get line/column pair.
     * @returns {{start:{line: number, column: number}, end:{line: number, column: number}}} The pair of line/column pair.
     */
    getLoc(start, end) {
        return this.tokenGenerator.getLoc(start, end)
    }

    /**
     * Check the character of the given offset is valid as a part of attribute name.
     * @param {number} offset The offset to check.
     * @returns {boolean} `true` if the character is valid.
     */
    isValidChar(offset) {
        return !(
            INVALID_CHARS.test(this.text[offset]) ||
            INVALID_PAIRS.has(this.text.slice(offset, offset + 2))
        )
    }

    /**
     * Get the offset at the 1st valid characters after the given offset.
     * @param {number} offset The offset to get.
     * @returns {number} The 1st valid characters after the given offset.
     */
    getIdentifierStart(offset) {
        let i = offset
        while (!this.isValidChar(i)) {
            i += 1
        }
        return i
    }

    /**
     * Get the offset at the 1st valid characters before the given offset.
     * @param {number} offset The offset to get.
     * @returns {number} The 1st valid characters before the given offset.
     */
    getIdentifierEnd(offset) {
        let i = offset - 1
        while (!this.isValidChar(i)) {
            i -= 1
        }
        return i + 1
    }

    /**
     * Create and append new token.
     * If the `end` is before `start`, this returns `null`.
     * @param {string} type The token type.
     * @param {number} start The start offset of the token.
     * @param {number} end The end offset of the token.
     * @returns {ASTNode|null} The created token.
     */
    appendToken(type, start, end) {
        if (start >= end) {
            return null
        }

        const token = this.tokenGenerator.createToken(type, start, end)
        this.tokens.push(token)
        return token
    }

    /**
     * Create new VText node.
     * @param {number} start The start offset to add.
     * @param {number} end The end offset to add.
     * @returns {ASTNode} The created node.
     */
    createVText(start, end) {
        const text = this.appendToken("VText", start, end)
        return {
            parent: null,
            type: text.type,
            range: text.range,
            loc: text.loc,
            value: text.value,
        }
    }

    /**
     * Create new VExpressionContainer node.
     * @param {number} start The start offset to add.
     * @param {number} end The end offset to add.
     * @param {number} quoteSize The size quotations.
     * @returns {ASTNode} The created node.
     */
    createVExpressionContainer(start, end, quoteSize) {
        this.appendToken("Punctuator", start, start + quoteSize)

        const result = {
            parent: null,
            type: "VExpressionContainer",
            range: [start, end],
            loc: this.getLoc(start, end),
            expression: null,
            syntaxError: null,
        }

        try {
            const ast = this.scriptParser.parseExpression(
                start + quoteSize,
                end - quoteSize
            )
            if (ast != null) {
                const tokens = ast.tokens || []
                const comments = ast.comments || []

                Array.prototype.push.apply(this.tokens, tokens)
                Array.prototype.push.apply(this.comments, comments)

                result.expression = ast
                ast.parent = result
            }
        }
        catch (error) {
            result.syntaxError = error
        }

        this.appendToken("Punctuator", end - quoteSize, end)

        return result
    }

    /**
     * Create new VIdentifier node.
     * @param {number} start The start offset to create.
     * @param {number} end The end offset to create.
     * @returns {ASTNode} The created node.
     */
    createVIdentifier(start, end) {
        const idStart = this.getIdentifierStart(start)
        let idEnd = 0

        if (end === undefined) {
            idEnd = idStart + 1
            while (this.isValidChar(idEnd)) {
                idEnd += 1
            }
        }
        else {
            idEnd = this.getIdentifierEnd(end)
        }

        const token = this.appendToken("VIdentifier", idStart, idEnd)
        return {
            parent: null,
            type: token.type,
            range: token.range,
            loc: token.loc,
            name: token.value,
        }
    }

    /**
     * Create new VDirectiveKey node.
     * @param {number} start The start offset to create.
     * @param {number} end The end offset to create.
     * @returns {ASTNode} The created node.
     */
    createVDirectiveKey(start, end) {
        this.appendToken("VIdentifier", start, end)

        let name = null
        let argument = null
        let modifiers = null
        let shorthand = false
        let remain = this.text.slice(start, end)

        if (remain.startsWith(":")) {
            name = "bind"
            shorthand = true
            remain = remain.slice(1)
        }
        else if (remain.startsWith("@")) {
            name = "on"
            shorthand = true
            remain = remain.slice(1)
        }
        else {
            const colon = remain.indexOf(":")
            if (colon !== -1) {
                name = remain.slice(0, colon)
                remain = remain.slice(colon + 1)
            }
        }

        const dotSplit = remain.split(".")
        if (name == null) {
            name = dotSplit[0]
        }
        else {
            argument = dotSplit[0]
        }
        modifiers = dotSplit.slice(1)

        if (name.startsWith("v-")) {
            name = name.slice(2)
        }

        return {
            parent: null,
            type: "VDirectiveKey",
            range: [start, end],
            loc: this.getLoc(start, end),
            name,
            argument,
            modifiers,
            shorthand,
        }
    }

    /**
     * Create new VAttributeValue node.
     * @param {number} start The start offset to create.
     * @param {number} end The end offset to create.
     * @param {string} value The value string which came from parse5.
     * @returns {ASTNode} The created node.
     */
    createVAttributeValue(start, end, value) {
        const literal = this.appendToken("VAttributeValue", start, end)
        return literal && {
            parent: null,
            type: literal.type,
            range: literal.range,
            loc: literal.loc,
            value,
            raw: literal.value,
        }
    }

    /**
     * Create new VAttribute node.
     * @param {string} name The attribute name which came from parse5.
     * @param {string} value The attribute value which came from parse5.
     * @param {module:parse5.AST.LocationInfo} location The location info.
     * @returns {ASTNode} The created node.
     */
    createVAttribute(name, value, location) {
        const directive = DIRECTIVE_NAME.test(name)
        const start = location.startOffset
        const end = location.endOffset
        let i = start

        const result = {
            parent: null,
            type: "VAttribute",
            range: [start, end],
            loc: this.getLoc(start, end),
            directive,
            key: null,
            value: null,
        }

        // Advance to `=`.
        while (i < end && this.text[i] !== "=") {
            i += 1
        }

        // Make the key.
        result.key = directive
            ? this.createVDirectiveKey(start, this.getIdentifierEnd(i))
            : this.createVIdentifier(start, i)
        result.key.parent = result

        if (i !== end) {
            this.appendToken("Punctuator", i, i + 1)

            // Advance to the start of the value.
            do {
                i += 1
            } while (i < end && SPACE.test(i))

            // Make the value.
            const quoteSize = QUOTES.test(this.text[i]) ? 1 : 0
            result.value = directive
                ? this.createVExpressionContainer(i, end, quoteSize)
                : this.createVAttributeValue(i, end, value)

            if (result.value != null) {
                result.value.parent = result
            }
        }

        return result
    }

    /**
     * Create new VStartTag node.
     * @param {module:parse5.AST.Element} node The element node to create.
     * @returns {ASTNode} The created node.
     */
    createVStartTag(node) {
        const location = node.__location.startTag || node.__location
        const start = location.startOffset
        const end = location.endOffset
        const attrs = node.attrs
        const attrLocs = node.__location.attrs
        const result = {
            parent: null,
            type: "VStartTag",
            range: [start, end],
            loc: this.getLoc(start, end),
            id: null,
            attributes: [],
            selfClosing: (this.text[end - 2] === "/"),
        }

        this.appendToken("Punctuator", start, start + 1)

        result.id = this.createVIdentifier(start + 1)
        result.id.parent = result

        for (const attr of attrs) {
            const name = attr.name
            const value = attr.value
            const attrLoc = attrLocs[name]
            const attribute = this.createVAttribute(name, value, attrLoc)

            attribute.parent = result
            result.attributes.push(attribute)
        }

        this.appendToken("Punctuator", end - (result.selfClosing ? 2 : 1), end)

        return result
    }

    /**
     * Create new VEndTag node.
     * @param {module:parse5.AST.Element} node The element node to create.
     * @returns {ASTNode} The created node.
     */
    createVEndTag(node) {
        const location = node.__location.endTag
        if (location == null) {
            return null
        }
        const start = location.startOffset
        const end = location.endOffset
        const result = {
            parent: null,
            type: "VEndTag",
            range: [start, end],
            loc: this.getLoc(start, end),
            id: null,
        }

        this.appendToken("Punctuator", start, start + 2)
        result.id = this.createVIdentifier(start + 2, end - 1)
        result.id.parent = result
        this.appendToken("Punctuator", end - 1, end)

        return result
    }

    /**
     * Transform the given parse5's comment node.
     * @param {module:parse5.AST.CommentNode} node The comment node to transform.
     * @returns {null} The comment node is dropped from AST.
     */
    visitCommentNode(node) {
        const start = node.__location.startOffset
        const end = node.__location.endOffset
        const comment = {
            type: "VComment",
            range: [start, end],
            loc: this.getLoc(start, end),
            value: this.text.slice(start + 4, end - 3),
        }

        this.comments.push(comment)

        return null
    }

    /**
     * Transform the given parse5's text node.
     * If there are mustaches, the transformation result is multiple.
     * @param {module:parse5.AST.TextNode} node The text node to transform.
     * @returns {ASTNode[]} The transformed nodes.
     */
    visitTextNode(node) {
        const retv = []
        const start = node.__location.startOffset
        const end = node.__location.endOffset
        const text = this.text.slice(start, end)
        let lastIndex = start
        let match = null

        MUSTACHE.lastIndex = 0
        while ((match = MUSTACHE.exec(text)) != null) {
            const ecStart = start + match.index
            const ecEnd = ecStart + match[0].length

            if (lastIndex !== ecStart) {
                retv.push(this.createVText(lastIndex, ecStart))
            }
            retv.push(this.createVExpressionContainer(ecStart, ecEnd, 2))

            lastIndex = ecEnd
        }
        if (lastIndex !== end) {
            retv.push(this.createVText(lastIndex, end))
        }

        return retv
    }

    /**
     * Transform the given parse5's element node.
     * @param {module:parse5.AST.Element} node The element node to transform.
     * @returns {ASTNode} The transformed node.
     */
    visitElementNode(node) {
        const start = node.__location.startOffset
        const end = node.__location.endOffset
        const childNodes = (node.tagName === "template")
            ? node.content.childNodes
            : node.childNodes

        const result = {
            parent: null,
            range: [start, end],
            loc: this.getLoc(start, end),
            type: "VElement",
            startTag: null,
            children: [],
            endTag: null,
        }

        result.startTag = this.createVStartTag(node)
        result.startTag.parent = result

        for (const childNode of childNodes) {
            const child = this.visit(childNode)

            if (Array.isArray(child)) {
                for (const child1 of child) {
                    child1.parent = result
                    result.children.push(child1)
                }
            }
            else if (child != null) {
                child.parent = result
                result.children.push(child)
            }
        }

        result.endTag = this.createVEndTag(node)
        if (result.endTag != null) {
            result.endTag.parent = result
        }

        return result
    }

    /**
     * Visit the given node to transform.
     * This is recursive.
     * @param {module:parse5.AST.Node} node The parse5's node to visit.
     * @returns {ASTNode|ASTNode[]} The transformed node.
     */
    visit(node) {
        if (node.nodeName === "#comment") {
            return this.visitCommentNode(node)
        }
        if (node.nodeName === "#text") {
            return this.visitTextNode(node)
        }
        if (!node.nodeName.startsWith("#")) {
            return this.visitElementNode(node)
        }

        debug("A node which is unknown type '%s' was ignored.", node.nodeName)
        return null
    }
}

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

module.exports = HTMLTransformer.transform
