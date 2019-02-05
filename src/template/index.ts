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

const shorthandSign = /^[:@#]/u
const shorthandNameMap = { ":": "bind", "@": "on", "#": "slot" }
const shorthandSignMap = { bind: ":", on: "@", slot: "#" }

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
function parseDirectiveKeyStatically(node: VIdentifier): VDirectiveKey {
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

    // Parse.
    if (shorthandSign.test(id)) {
        const sign = id[0] as ":" | "@" | "#"
        ret.name = raw.name = shorthandNameMap[sign]
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

    return ret
}

/**
 * Parse the tokens of a given key node.
 * @param node The key node to parse.
 */
function parseDirectiveKeyTokens(
    node: VDirectiveKey,
    locationCalculator: LocationCalculator,
): Token[] {
    const raw = node.raw
    const tokens: Token[] = []
    let i = 0

    if (node.shorthand) {
        const name = raw.name as "bind" | "on" | "slot"
        tokens.push(
            createSimpleToken(
                "Punctuator",
                node.range[0],
                node.range[0] + 1,
                shorthandSignMap[name],
                locationCalculator,
            ),
        )
        i = 1
    } else if (raw.name) {
        tokens.push(
            createSimpleToken(
                "HTMLIdentifier",
                node.range[0],
                node.range[0] + raw.name.length,
                raw.name,
                locationCalculator,
            ),
        )
        i = raw.name.length

        if (raw.argument) {
            tokens.push(
                createSimpleToken(
                    "Punctuator",
                    node.range[0] + i,
                    node.range[0] + i + 1,
                    ":",
                    locationCalculator,
                ),
            )
            i += 1
        }
    }

    if (raw.argument) {
        tokens.push(
            createSimpleToken(
                "HTMLIdentifier",
                node.range[0] + i,
                node.range[0] + i + raw.argument.length,
                raw.argument,
                locationCalculator,
            ),
        )
        i += raw.argument.length
    }

    for (const modifier of raw.modifiers) {
        tokens.push(
            createSimpleToken(
                "Punctuator",
                node.range[0] + i,
                node.range[0] + i + 1,
                ".",
                locationCalculator,
            ),
            createSimpleToken(
                "HTMLIdentifier",
                node.range[0] + i + 1,
                node.range[0] + i + 1 + modifier.length,
                modifier,
                locationCalculator,
            ),
        )
        i += 1 + modifier.length
    }

    return tokens
}

/**
 * Convert `node.argument` property to a `VExpressionContainer` node if it's a dynamic argument.
 * @param text The source code text of the directive key node.
 * @param node The directive key node to convert.
 * @param document The belonging document node.
 * @param parserOptions The parser options to parse.
 * @param locationCalculator The location calculator to parse.
 */
function convertDynamicArgument(
    text: string,
    node: VDirectiveKey,
    document: VDocumentFragment | null,
    parserOptions: any,
    locationCalculator: LocationCalculator,
): void {
    const argument = node.raw.argument
    if (
        typeof argument !== "string" ||
        !argument.startsWith("[") ||
        !argument.endsWith("]")
    ) {
        return
    }

    const start = node.range[0] + text.indexOf(argument)
    const end = start + argument.length
    try {
        const { comments, expression, references, tokens } = parseExpression(
            argument.slice(1, -1),
            locationCalculator.getSubCalculatorAfter(start + 1),
            parserOptions,
        )

        node.argument = {
            type: "VExpressionContainer",
            range: [start, end],
            loc: {
                start: locationCalculator.getLocation(start),
                end: locationCalculator.getLocation(end),
            },
            parent: node,
            expression,
            references,
        }

        if (expression != null) {
            expression.parent = node.argument
        }

        // Add tokens of `[` and `]`.
        tokens.unshift(
            createSimpleToken(
                "Punctuator",
                start,
                start + 1,
                "[",
                locationCalculator,
            ),
        )
        tokens.push(
            createSimpleToken(
                "Punctuator",
                end - 1,
                end,
                "]",
                locationCalculator,
            ),
        )

        replaceTokens(document, node.argument, tokens)
        insertComments(document, comments)
    } catch (error) {
        debug("[template] Parse error: %s", error)

        if (ParseError.isParseError(error)) {
            node.argument = {
                type: "VExpressionContainer",
                range: [start, end],
                loc: {
                    start: locationCalculator.getLocation(start),
                    end: locationCalculator.getLocation(end),
                },
                parent: node,
                expression: null,
                references: [],
            }
            insertError(document, error)
        } else {
            throw error
        }
    }
}

/**
 * Parse the given attribute name as a directive key.
 * @param node The identifier node to parse.
 * @returns The directive key node.
 */
function createDirectiveKey(
    node: VIdentifier,
    document: VDocumentFragment | null,
    parserOptions: any,
    locationCalculator: LocationCalculator,
): VDirectiveKey {
    // Parse node and tokens.
    const ret = parseDirectiveKeyStatically(node)
    const tokens = parseDirectiveKeyTokens(ret, locationCalculator)
    replaceTokens(document, ret, tokens)

    // Drop `v-` prefix.
    if (ret.name.startsWith("v-")) {
        ret.name = ret.name.slice(2)
        ret.raw.name = ret.raw.name.slice(2)
    }

    // Parse dynamic argument.
    convertDynamicArgument(
        node.rawName,
        ret,
        document,
        parserOptions,
        locationCalculator,
    )

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
        directiveKey.name === "slot" ||
        directiveKey.name === "slot-scope" ||
        (tagName === "template" && directiveKey.name === "scope")
    ) {
        if (directiveKey.name === "slot" && directiveKey.argument == null) {
            directiveKey.argument = "default"
        }
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

    const document = getOwnerDocument(node)
    const directive: VDirective = node as any
    directive.directive = true
    directive.key = createDirectiveKey(
        node.key,
        document,
        parserOptions,
        locationCalculator,
    )

    if (node.value == null) {
        return
    }

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
