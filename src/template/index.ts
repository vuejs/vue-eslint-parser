/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import * as lodash from "lodash"
import {ParseError, Reference, Token, Variable, VAttribute, VDirective, VDirectiveKey, VDocumentFragment, VExpressionContainer, VIdentifier, VLiteral, VNode} from "../ast"
import {debug} from "../common/debug"
import {LocationCalculator} from "../common/location-calculator"
import {ExpressionParseResult, parseExpression, parseVForExpression} from "../script"

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
 * Get the belonging document of the given node.
 * @param leafNode The node to get.
 * @returns The belonging document.
 */
function getOwnerDocument(leafNode: VNode): VDocumentFragment | null {
    let node: VNode | null = leafNode
    while (node != null && node.type !== "VDocumentFragment") {
        node = node.parent
    }
    return node
}

/**
 * Create a simple token.
 * @param type The type of new token.
 * @param start The offset of the start position of new token.
 * @param end The offset of the end position of new token. 
 * @param value The value of new token.
 * @returns The new token.
 */
function createSimpleToken(type: string, start: number, end: number, value: string, globalLocationCalculator: LocationCalculator): Token {
    return {
        type,
        range: [start, end],
        loc: {
            start: globalLocationCalculator.getLocation(start),
            end: globalLocationCalculator.getLocation(end),
        },
        value,
    }
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

interface HasRange {
    range: [number, number]
}

/**
 * Get `x.range[0]`.
 * @param x The object to get.
 * @returns `x.range[0]`.
 */
function byRange0(x: HasRange): number {
    return x.range[0]
}

/**
 * Get `x.range[1]`.
 * @param x The object to get.
 * @returns `x.range[1]`.
 */
function byRange1(x: HasRange): number {
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
 * Replace the tokens in the given range.
 * @param document The document that the node is belonging to.
 * @param node The node to specify the range of replacement.
 * @param newTokens The new tokens.
 */
function replaceTokens(document: VDocumentFragment | null, node: HasRange, newTokens: Token[]): void {
    if (document == null) {
        return
    }

    const index = lodash.sortedIndexBy(document.tokens, node, byRange0)
    const count = lodash.sortedLastIndexBy(document.tokens, node, byRange1) - index
    splice(document.tokens, index, count, newTokens)
}

/**
 * Insert the given comment tokens.
 * @param document The document that the node is belonging to.
 * @param newComments The comments to insert.
 */
function insertComments(document: VDocumentFragment | null, newComments: Token[]): void {
    if (document == null || newComments.length === 0) {
        return
    }

    const index = lodash.sortedIndexBy(document.comments, newComments[0], byRange0)
    splice(document.comments, index, 0, newComments)
}

/**
 * Insert the given error.
 * @param document The document that the node is belonging to.
 * @param error The error to insert.
 */
function insertError(document: VDocumentFragment | null, error: ParseError): void {
    if (document == null) {
        return
    }

    const index = lodash.sortedIndexBy(document.errors, error, byIndex)
    document.errors.splice(index, 0, error)
}

/**
 * Parse the given attribute value as an expression.
 * @param code Whole source code text.
 * @param parserOptions The parser options to parse expressions.
 * @param globalLocationCalculator The location calculator to adjust the locations of nodes.
 * @param node The attribute node to replace. This function modifies this node directly.
 * @param vFor The flag which indicates that this directive is `v-for`.
 */
function parseAttributeValue(code: string, parserOptions: any, globalLocationCalculator: LocationCalculator, node: VLiteral, vFor: boolean): ExpressionParseResult {
    if (node.value.trim() === "") {
        throw new ParseError(
            "Unexpected empty",
            undefined,
            node.range[0],
            node.loc.start.line,
            node.loc.end.line
        )
    }

    const firstChar = code[node.range[0]]
    const quoted = (firstChar === "\"" || firstChar === "'")
    const locationCalculator = globalLocationCalculator.getSubCalculatorAfter(node.range[0] + (quoted ? 1 : 0))
    const result = vFor
        ? parseVForExpression(node.value, locationCalculator, parserOptions)
        : parseExpression(node.value, locationCalculator, parserOptions)

    // Add the tokens of quotes.
    if (quoted) {
        result.tokens.unshift(
            createSimpleToken("Punctuator", node.range[0], node.range[0] + 1, firstChar, globalLocationCalculator)
        )
        result.tokens.push(
            createSimpleToken("Punctuator", node.range[1] - 1, node.range[1], firstChar, globalLocationCalculator)
        )
    }

    return result
}

/**
 * Information of a mustache.
 */
export interface Mustache {
    value: string
    startToken: Token
    endToken: Token
}

/**
 * Replace the given attribute by a directive.
 * @param code Whole source code text.
 * @param parserOptions The parser options to parse expressions.
 * @param locationCalculator The location calculator to adjust the locations of nodes.
 * @param node The attribute node to replace. This function modifies this node directly.
 */
export function convertToDirective(code: string, parserOptions: any, locationCalculator: LocationCalculator, node: VAttribute): void {
    debug("[template] convert to directive: %s=\"%s\" %j", node.key.name, node.value && node.value.value, node.range)

    const directive: VDirective = node as any
    directive.directive = true
    directive.key = createDirectiveKey(node.key)

    if (node.value == null) {
        return
    }
    const document = getOwnerDocument(node)

    try {
        const vFor = directive.key.name === "for"
        const vOn = directive.key.name === "on"
        const ret = parseAttributeValue(code, parserOptions, locationCalculator, node.value, vFor)

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
            node.parent.parent.variables.push(variable)
        }

        replaceTokens(document, node.value, ret.tokens)
        insertComments(document, ret.comments)
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
            insertError(document, err)
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
export function defineScopeAttributeVariable(code: string, parserOptions: any, locationCalculator: LocationCalculator, node: VAttribute): void {
    debug("[template] define variable: %s=\"%s\" %j", node.key.name, node.value && node.value.value, node.range)

    if (node.value == null) {
        return
    }

    try {
        const ret = parseAttributeValue(code, parserOptions, locationCalculator, node.value, false)
        extractScopeVariables(ret.references, node.parent.parent.variables)
    }
    catch (err) {
        debug("[template] Parse error: %s", err)

        if (ParseError.isParseError(err)) {
            insertError(getOwnerDocument(node), err)
        }
        else {
            throw err
        }
    }
}

/**
 * Parse the content of the given mustache.
 * @param parserOptions The parser options to parse expressions.
 * @param globalLocationCalculator The location calculator to adjust the locations of nodes.
 * @param node The expression container node. This function modifies the `expression` and `references` properties of this node.
 * @param mustache The information of mustache to parse.
 */
export function processMustache(parserOptions: any, globalLocationCalculator: LocationCalculator, node: VExpressionContainer, mustache: Mustache): void {
    const range: [number, number] = [mustache.startToken.range[1], mustache.endToken.range[0]]
    debug("[template] convert mustache {{%s}} %j", mustache.value, range)

    const document = getOwnerDocument(node)
    try {
        const locationCalculator = globalLocationCalculator.getSubCalculatorAfter(range[0])
        const ret = parseExpression(mustache.value, locationCalculator, parserOptions)

        node.expression = ret.expression
        node.references = ret.references

        replaceTokens(document, {range}, ret.tokens)
        insertComments(document, ret.comments)
    }
    catch (err) {
        debug("[template] Parse error: %s", err)

        if (ParseError.isParseError(err)) {
            insertError(document, err)
        }
        else {
            throw err
        }
    }
}
