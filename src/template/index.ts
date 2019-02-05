/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import sortedIndexBy from "lodash/sortedIndexBy"
import sortedLastIndexBy from "lodash/sortedLastIndexBy"
import {
    DirectiveKeyParts,
    ESLintExpression,
    ParseError,
    Reference,
    Token,
    VAttribute,
    VDirective,
    VDirectiveKey,
    VDocumentFragment,
    VElement,
    VExpressionContainer,
    VFilterSequenceExpression,
    VForExpression,
    VIdentifier,
    VLiteral,
    VNode,
    VOnExpression,
    VSlotScopeExpression,
} from "../ast"
import { debug } from "../common/debug"
import { LocationCalculator } from "../common/location-calculator"
import {
    ExpressionParseResult,
    parseExpression,
    parseVForExpression,
    parseVOnExpression,
    parseSlotScopeExpression,
} from "../script"

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
function createSimpleToken(
    type: string,
    start: number,
    end: number,
    value: string,
    globalLocationCalculator: LocationCalculator,
): Token {
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
    const raw: DirectiveKeyParts = {
        name: "",
        argument: null,
        modifiers: [],
    }
    const ret: VDirectiveKey = {
        type: "VDirectiveKey",
        range: node.range,
        loc: node.loc,
        parent: node.parent,
        name: "",
        argument: null,
        modifiers: [],
        shorthand: false,
        raw,
    }
    const id = node.name
    const rawId = node.rawName
    let i = 0

    if (node.name.startsWith(":")) {
        ret.name = raw.name = "bind"
        ret.shorthand = true
        i = 1
    } else if (id.startsWith("@")) {
        ret.name = raw.name = "on"
        ret.shorthand = true
        i = 1
    } else {
        const colon = id.indexOf(":")
        if (colon !== -1) {
            ret.name = id.slice(0, colon)
            raw.name = rawId.slice(0, colon)
            i = colon + 1
        }
    }

    const dotSplit = id.slice(i).split(".")
    const dotSplitRaw = rawId.slice(i).split(".")
    if (ret.name === "") {
        ret.name = dotSplit[0]
        raw.name = dotSplitRaw[0]
    } else {
        ret.argument = dotSplit[0]
        raw.argument = dotSplitRaw[0]
    }
    ret.modifiers = dotSplit.slice(1)
    raw.modifiers = dotSplitRaw.slice(1)

    if (ret.name.startsWith("v-")) {
        ret.name = ret.name.slice(2)
        raw.name = raw.name.slice(2)
    }

    return ret
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
function replaceTokens(
    document: VDocumentFragment | null,
    node: HasRange,
    newTokens: Token[],
): void {
    if (document == null) {
        return
    }

    const index = sortedIndexBy(document.tokens, node, byRange0)
    const count = sortedLastIndexBy(document.tokens, node, byRange1) - index
    document.tokens.splice(index, count, ...newTokens)
}

/**
 * Insert the given comment tokens.
 * @param document The document that the node is belonging to.
 * @param newComments The comments to insert.
 */
function insertComments(
    document: VDocumentFragment | null,
    newComments: Token[],
): void {
    if (document == null || newComments.length === 0) {
        return
    }

    const index = sortedIndexBy(document.comments, newComments[0], byRange0)
    document.comments.splice(index, 0, ...newComments)
}

/**
 * Insert the given error.
 * @param document The document that the node is belonging to.
 * @param error The error to insert.
 */
function insertError(
    document: VDocumentFragment | null,
    error: ParseError,
): void {
    if (document == null) {
        return
    }

    const index = sortedIndexBy(document.errors, error, byIndex)
    document.errors.splice(index, 0, error)
}

/**
 * Parse the given attribute value as an expression.
 * @param code Whole source code text.
 * @param parserOptions The parser options to parse expressions.
 * @param globalLocationCalculator The location calculator to adjust the locations of nodes.
 * @param node The attribute node to replace. This function modifies this node directly.
 * @param tagName The name of this tag.
 * @param directiveKey The key of this directive.
 */
function parseAttributeValue(
    code: string,
    parserOptions: any,
    globalLocationCalculator: LocationCalculator,
    node: VLiteral,
    tagName: string,
    directiveKey: VDirectiveKey,
): ExpressionParseResult<
    | ESLintExpression
    | VFilterSequenceExpression
    | VForExpression
    | VOnExpression
    | VSlotScopeExpression
> {
    const firstChar = code[node.range[0]]
    const quoted = firstChar === '"' || firstChar === "'"
    const locationCalculator = globalLocationCalculator.getSubCalculatorAfter(
        node.range[0] + (quoted ? 1 : 0),
    )

    let result: ExpressionParseResult<
        | ESLintExpression
        | VFilterSequenceExpression
        | VForExpression
        | VOnExpression
        | VSlotScopeExpression
    >
    if (quoted && node.value === "") {
        result = {
            expression: null,
            tokens: [],
            comments: [],
            variables: [],
            references: [],
        }
    } else if (directiveKey.name === "for") {
        result = parseVForExpression(
            node.value,
            locationCalculator,
            parserOptions,
        )
    } else if (directiveKey.name === "on" && directiveKey.argument != null) {
        result = parseVOnExpression(
            node.value,
            locationCalculator,
            parserOptions,
        )
    } else if (
        directiveKey.name === "slot-scope" ||
        (tagName === "template" && directiveKey.name === "scope")
    ) {
        result = parseSlotScopeExpression(
            node.value,
            locationCalculator,
            parserOptions,
        )
    } else if (directiveKey.name === "bind") {
        result = parseExpression(
            node.value,
            locationCalculator,
            parserOptions,
            { allowFilters: true },
        )
    } else {
        result = parseExpression(node.value, locationCalculator, parserOptions)
    }

    // Add the tokens of quotes.
    if (quoted) {
        result.tokens.unshift(
            createSimpleToken(
                "Punctuator",
                node.range[0],
                node.range[0] + 1,
                firstChar,
                globalLocationCalculator,
            ),
        )
        result.tokens.push(
            createSimpleToken(
                "Punctuator",
                node.range[1] - 1,
                node.range[1],
                firstChar,
                globalLocationCalculator,
            ),
        )
    }

    return result
}

/**
 * Resolve the variable of the given reference.
 * @param referene The reference to resolve.
 * @param element The belonging element of the reference.
 */
function resolveReference(referene: Reference, element: VElement): void {
    let node: VNode | null = element

    // Find the variable of this reference.
    while (node != null && node.type === "VElement") {
        for (const variable of node.variables) {
            if (variable.id.name === referene.id.name) {
                referene.variable = variable
                variable.references.push(referene)
                return
            }
        }

        node = node.parent
    }
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
export function convertToDirective(
    code: string,
    parserOptions: any,
    locationCalculator: LocationCalculator,
    node: VAttribute,
): void {
    debug(
        '[template] convert to directive: %s="%s" %j',
        node.key.name,
        node.value && node.value.value,
        node.range,
    )

    const directive: VDirective = node as any
    directive.directive = true
    directive.key = createDirectiveKey(node.key)

    if (node.value == null) {
        return
    }
    const document = getOwnerDocument(node)

    try {
        const ret = parseAttributeValue(
            code,
            parserOptions,
            locationCalculator,
            node.value,
            node.parent.parent.name,
            directive.key,
        )

        directive.value = {
            type: "VExpressionContainer",
            range: node.value.range,
            loc: node.value.loc,
            parent: directive,
            expression: ret.expression,
            references: ret.references,
        }
        if (ret.expression != null) {
            ret.expression.parent = directive.value
        }

        for (const variable of ret.variables) {
            node.parent.parent.variables.push(variable)
        }

        replaceTokens(document, node.value, ret.tokens)
        insertComments(document, ret.comments)
    } catch (err) {
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
        } else {
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
export function processMustache(
    parserOptions: any,
    globalLocationCalculator: LocationCalculator,
    node: VExpressionContainer,
    mustache: Mustache,
): void {
    const range: [number, number] = [
        mustache.startToken.range[1],
        mustache.endToken.range[0],
    ]
    debug("[template] convert mustache {{%s}} %j", mustache.value, range)

    const document = getOwnerDocument(node)
    try {
        const locationCalculator = globalLocationCalculator.getSubCalculatorAfter(
            range[0],
        )
        const ret = parseExpression(
            mustache.value,
            locationCalculator,
            parserOptions,
            { allowEmpty: true, allowFilters: true },
        )

        node.expression = ret.expression || null
        node.references = ret.references
        if (ret.expression != null) {
            ret.expression.parent = node
        }

        replaceTokens(document, { range }, ret.tokens)
        insertComments(document, ret.comments)
    } catch (err) {
        debug("[template] Parse error: %s", err)

        if (ParseError.isParseError(err)) {
            insertError(document, err)
        } else {
            throw err
        }
    }
}

/**
 * Resolve all references of the given expression container.
 * @param container The expression container to resolve references.
 */
export function resolveReferences(container: VExpressionContainer): void {
    let element: VNode | null = container.parent

    // Get the belonging element.
    while (element != null && element.type !== "VElement") {
        element = element.parent
    }

    // Resolve.
    if (element != null) {
        for (const reference of container.references) {
            resolveReference(reference, element)
        }
    }
}
