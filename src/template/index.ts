/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import lodash from "lodash"
import {HasConcreteInfo, HasLocation, ParseError, Reference, Token, Variable, VAttribute, VDirective, VDirectiveKey, VDocumentFragment, VElement, VExpressionContainer, VIdentifier, VLiteral, VText} from "../ast"
import {debug} from "../common/debug"
import {LocationCalculator} from "../common/location-calculator"
import {ExpressionParseResult, parseExpression, parseVForExpression} from "../script"

const DIRECTIVE_NAME = /^(?:v-|[:@]).+[^.:@]$/

/**
 * Extract the variable declarations of scope attributes.
 * @param references The references which are variable declarations.
 * @param outVariables The variable declarations. This is output.
 */
function extractScopeVariables(references: Reference[], outVariables: Variable[]): void {
    let reference: Reference | undefined
    while ((reference = references.shift()) != null) {
        reference.id.parent = null
        outVariables.push({id: reference.id, kind: "scope"})
    }
}

/**
 * Remove references by name.
 * @param references The array of references to remove.
 * @param name The name of target references.
 */
function removeByName(references: Reference[], name: string): void {
    let i = 0
    while (i < references.length) {
        const reference = references[i]

        if (reference.id.name === name) {
            references.splice(i, 1)
        }
        else {
            i += 1
        }
    }
}

/**
 * Get the attribute which has the given name from the given element.
 * @param node The element node to get.
 * @param key The attribute name to get.
 * @returns The found attribute or undefined.
 */
function getAttributeValue(node: VElement, key: string): string | undefined {
    const attr = node.startTag.attributes.find(a => a.key.name === key)
    return (attr && !attr.directive && attr.value) ? attr.value.value : undefined
}

/**
 * Get the belonging document of the given node.
 * @param leafNode The node to get.
 * @returns The belonging document.
 */
function getGlobalDocument(leafNode: VElement): VDocumentFragment | null {
    let node: VElement | VDocumentFragment | null = leafNode
    while (node != null && node.type !== "VDocumentFragment") {
        node = node.parent
    }
    return node
}

/**
 * Parse the given attribute name as a directive key.
 * @param node The identifier node to parse.
 * @returns The directive key node.
 */
function createDirectiveKey(node: VIdentifier): VDirectiveKey {
    let name = null
    let argument = null
    let modifiers = null
    let shorthand = false
    let remain = node.name

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
        type: "VDirectiveKey",
        range: node.range,
        loc: node.loc,
        parent: node.parent,
        name,
        argument,
        modifiers,
        shorthand,
    }
}

/**
 * Do splice.
 * @param items The array to operate.
 * @param start The start index.
 * @param deleteCount The count of items to delete.
 * @param newItems The array of items to insert.
 */
function splice<T>(items: T[], start: number, deleteCount: number, newItems: T[]): void {
    switch (newItems.length) {
        case 0:
            items.splice(start, deleteCount)
            break
        case 1:
            items.splice(start, deleteCount, newItems[0])
            break
        case 2:
            items.splice(start, deleteCount, newItems[0], newItems[1])
            break
        default:
            Array.prototype.splice.apply(
                items,
                ([start, deleteCount] as any[]).concat(newItems)
            )
            break
    }
}

/**
 * Get `x.range[0]`.
 * @param x The object to get.
 * @returns `x.range[0]`.
 */
function byRange0(x: HasLocation): number {
    return x.range[0]
}

/**
 * Get `x.range[1]`.
 * @param x The object to get.
 * @returns `x.range[1]`.
 */
function byRange1(x: HasLocation): number {
    return x.range[1]
}

/**
 * Get `x.pos`.
 * @param x The object to get.
 * @returns `x.pos`.
 */
function byIndex(x: ParseError): number {
    return x.index
}

/**
 * The template transformer to make expression containers.
 */
export class TemplateTransformer {
    private code: string
    private templateNode: VElement
    private locationCalculator: LocationCalculator
    private parserOptions: any
    private tokens: Token[]
    private comments: Token[]
    private errors: ParseError[]

    /**
     * Initialize this transformer.
     * @param code The source code.
     * @param node The `<template>` node.
     * @param globalLocationCalculator The location calculator.
     * @param parserOptions The parser options.
     */
    constructor(code: string, node: VElement, globalLocationCalculator: LocationCalculator, parserOptions: any) {
        this.code = code
        this.templateNode = node
        this.locationCalculator = globalLocationCalculator
        this.parserOptions = parserOptions

        // Get tokens, comments, and errors.
        const document = getGlobalDocument(node)
        this.tokens = (document != null) ? document.tokens : []
        this.comments = (document != null) ? document.comments : []
        this.errors = (document != null) ? document.errors : []
    }

    /**
     * Transform the `<template>` node which was given on the constructor.
     * @returns The transforming result.
     */
    public transform(): VElement & HasConcreteInfo {
        this.generateExpressionContainers(this.templateNode)

        // Create document.
        return Object.assign(this.templateNode, {
            tokens: this.tokens,
            comments: this.comments,
            errors: this.errors,
        })
    }

    /**
     * Generate expression containers on the given node.
     * @param node The node which is the transforming target.
     */
    private generateExpressionContainers(node: VElement): void {
        // Address directives
        for (const attribute of node.startTag.attributes as VAttribute[]) {
            if (DIRECTIVE_NAME.test(attribute.key.name)) {
                this.replaceAttributeByDirective(attribute, node.variables)
            }
            else if (node.name === "template" && attribute.key.name === "scope") {
                // This attribute defines a variable: https://vuejs.org/v2/guide/components.html#Scoped-Slots
                this.defineScopeAttributeVariable(attribute, node.variables)
            }
        }

        for (let i = 0; i < node.children.length; ++i) {
            const child = node.children[i]

            // Address mustaches
            if (child.type === "VText") {
                i += this.replaceMustaches(child, i)
            }
            // Address children recursively.
            else if (child.type === "VElement") {
                this.generateExpressionContainers(child)
            }
        }
    }

    /**
     * Replace the given attribute node by a directive node.
     * @param node The attribute node to replace.
     */
    private replaceAttributeByDirective(node: VAttribute, outVariables: Variable[]): void {
        debug("[template] convert directive %s=\"%s\" %j", node.key.name, node.value && node.value.value, node.range)

        const directive: VDirective = node as any
        directive.directive = true
        directive.key = createDirectiveKey(node.key)

        if (node.value == null) {
            return
        }

        try {
            const vFor = directive.key.name === "for"
            const vOn = directive.key.name === "on"
            const ret = this.parseAttributeValue(node.value, vFor)

            // https://vuejs.org/v2/api/#v-on
            // $event is not external references.
            if (vOn) {
                removeByName(ret.references, "$event")
            }

            directive.value = {
                type: "VExpressionContainer",
                range: node.value.range,
                loc: node.value.loc,
                parent: directive,
                expression: ret.expression,
                references: ret.references,
            }
            directive.value.parent = directive

            for (const variable of ret.variables) {
                outVariables.push(variable)
            }

            this.replaceTokens(node.value, ret.tokens)
            this.insertComments(ret.comments)
        }
        catch (err) {
            debug("[template] Parse error: %s", err)
            if (ParseError.isParseError(err)) {
                directive.value = {
                    type: "VExpressionContainer",
                    range: node.value.range,
                    loc: node.value.loc,
                    parent: directive,
                    expression: null,
                    references: [],
                }
                this.replaceTokens(node.value, [])
                this.insertError(err)
            }
            else {
                throw err
            }
        }
    }

    /**
     * Define the scope variable.
     * @param node The attribute node to define the scope variable.
     * @param outVariables The array of variables. This is output.
     */
    private defineScopeAttributeVariable(node: VAttribute, outVariables: Variable[]): void {
        if (node.value == null) {
            return
        }

        try {
            const ret = this.parseAttributeValue(node.value, false)
            extractScopeVariables(ret.references, outVariables)
        }
        catch (err) {
            debug("[template] Parse error: %s", err)
            if (ParseError.isParseError(err)) {
                this.insertError(err)
            }
            else {
                throw err
            }
        }
    }

    /**
     * Parse the given literal node as an inline script.
     * This method has no side-effect.
     * @param node The literal node to parse.
     * @param vFor `true` if this literal node is `v-for` directive's.
     * @returns The result of parsing.
     */
    private parseAttributeValue(node: VLiteral, vFor: boolean): ExpressionParseResult {
        if (node.value.trim() === "") {
            throw new ParseError(
                "Unexpected empty",
                undefined,
                node.range[0],
                node.loc.start.line,
                node.loc.end.line
            )
        }

        const firstChar = this.code[node.range[0]]
        const quoted = (firstChar === "\"" || firstChar === "'")
        const locationCalculator = this.locationCalculator.getSubCalculatorAfter(node.range[0] + (quoted ? 1 : 0))
        const result = vFor
            ? parseVForExpression(node.value, locationCalculator, this.parserOptions)
            : parseExpression(node.value, locationCalculator, this.parserOptions)

        // Add the tokens of quotes.
        if (quoted) {
            result.tokens.unshift(
                this.createSimpleToken("Punctuator", node.range[0], node.range[0] + 1, firstChar)
            )
            result.tokens.push(
                this.createSimpleToken("Punctuator", node.range[1] - 1, node.range[1], firstChar)
            )
        }

        return result
    }

    /**
     * Replace the given text node by the list of texts and expression containers.
     * @param node The text node to replace.
     * @param index The index of the node in the `parent.children` array.
     * @returns The count of increased nodes.
     */
    private replaceMustaches(node: VText, index: number): number {
        const nodes = [] as (VText | VExpressionContainer)[]
        let cursor = lodash.sortedIndexBy(this.tokens, node, byRange0)
        let text = ""

        /**
         * Advance the cursor until the token of the given type is found.
         * @param type The token type to find.
         * @param recording The flag to record the text of dropped tokens.
         * @returns The found token.
         */
        const advanceCursor = (type: string, recording: boolean): Token | null => {
            text = ""

            let token = this.tokens[cursor]
            while (token != null && token.range[1] <= node.range[1] && token.type !== type) {
                if (recording) {
                    text += token.value
                }
                token = this.tokens[++cursor]
            }

            if (token != null && token.type === type) {
                cursor += 1
                return token
            }
            return null
        }

        /**
         * Commit the tokens from `start`(include) to `end`(exclude) as a text node.
         * @param start The token type to find.
         * @param end The flag to record the text of dropped tokens.
         */
        const commitTextNode = (start: number, end: number): void => {
            if (start >= end) {
                return
            }
            let token = this.tokens[start]

            const newNode: VText = {
                type: "VText",
                range: [token.range[0], token.range[1]],
                loc: {start: token.loc.start, end: token.loc.end},
                parent: node.parent,
                value: token.value,
            }

            for (let i = start + 1; i < end; ++i) {
                token = this.tokens[i]
                newNode.range[1] = token.range[1]
                newNode.loc.end = token.loc.end
                newNode.value += token.value
            }

            nodes.push(newNode)
        }

        while (true) {
            // Find `{{` and '}}'
            const lastIndex = cursor
            const openToken = advanceCursor("VExpressionStart", false)
            const replaceStart = cursor
            const closeToken = advanceCursor("VExpressionEnd", true)
            const replaceCount = cursor - replaceStart - 1

            if (openToken == null || closeToken == null) {
                if (nodes.length >= 1) {
                    commitTextNode(lastIndex, cursor)
                }
                break
            }
            commitTextNode(lastIndex, replaceStart - 1)

            // Parse the expression.
            try {
                debug("[template] convert mustache \"%s\" %j", text, [openToken.range[0], closeToken.range[1]])

                const locationCalculator = this.locationCalculator.getSubCalculatorAfter(openToken.range[1])
                const ret = parseExpression(text, locationCalculator, this.parserOptions)
                nodes.push({
                    type: "VExpressionContainer",
                    range: [openToken.range[0], closeToken.range[1]],
                    loc: {start: openToken.loc.start, end: closeToken.loc.end},
                    parent: node.parent,
                    expression: ret.expression,
                    references: ret.references,
                })
                splice(this.tokens, replaceStart, replaceCount, ret.tokens)
                this.insertComments(ret.comments)
            }
            catch (err) {
                debug("[template] Parse error: %s", err)
                if (ParseError.isParseError(err)) {
                    nodes.push({
                        type: "VExpressionContainer",
                        range: [openToken.range[0], closeToken.range[1]],
                        loc: {start: openToken.loc.start, end: closeToken.loc.end},
                        parent: node.parent,
                        expression: null,
                        references: [],
                    })
                    this.tokens.splice(replaceStart, replaceCount)
                    this.insertError(err)
                }
                else {
                    throw err
                }
            }
        }

        // Replace nodes.
        if (nodes.length >= 1) {
            splice(node.parent.children, index, 1, nodes)
            return nodes.length - 1
        }

        return 0
    }

    /**
     * Create a simple token.
     * @param type The type of new token.
     * @param start The offset of the start position of new token.
     * @param end The offset of the end position of new token. 
     * @param value The value of new token.
     * @returns The new token.
     */
    private createSimpleToken(type: string, start: number, end: number, value: string): Token {
        return {
            type,
            range: [start, end],
            loc: {
                start: this.locationCalculator.getLocation(start),
                end: this.locationCalculator.getLocation(end),
            },
            value,
        }
    }

    /**
     * Replace the tokens in the given range.
     * @param node The node to specify the range of replacement.
     * @param tokens The new tokens.
     */
    private replaceTokens(node: HasLocation, tokens: Token[]): void {
        const index = lodash.sortedIndexBy(this.tokens, node, byRange0)
        const count = lodash.sortedLastIndexBy(this.tokens, node, byRange1) - index

        splice(this.tokens, index, count, tokens)
    }

    /**
     * Insert the given comment tokens.
     * @param comments The comments to insert.
     */
    private insertComments(comments: Token[]): void {
        if (comments.length === 0) {
            return
        }

        const index = lodash.sortedIndexBy(this.comments, comments[0], byRange0)
        splice(this.comments, index, 0, comments)
    }

    /**
     * Insert the given error.
     * @param error The error to insert.
     */
    private insertError(error: ParseError): void {
        const index = lodash.sortedIndexBy(this.errors, error, byIndex)
        this.errors.splice(index, 0, error)
    }
}

/**
 * Transform the given `<template>` element for expression containers.
 * @param code The source code.
 * @param node The `<template>` node to parse.
 * @param globalLocationCalculator The location calculator.
 * @param parserOptions The parser options.
 * @returns The transforming result.
 */
export function parseTemplateElement(code: string, node: VElement, globalLocationCalculator: LocationCalculator, parserOptions: any): (VElement & HasConcreteInfo) | undefined {
    // This supports only HTML for now.
    const lang = getAttributeValue(node, "lang") || "html"
    if (lang !== "html") {
        return undefined
    }

    return new TemplateTransformer(code, node, globalLocationCalculator, parserOptions).transform()
}
