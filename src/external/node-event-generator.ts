/**
 * This file is copied from `eslint/lib/util/node-event-generator.js`
 */
import EventEmitter from "events"
import esquery, {Selector} from "esquery"
import union from "lodash/union"
import intersection from "lodash/intersection"
import memoize from "lodash/memoize"
import {Node} from "../ast"

interface NodeSelector {
    rawSelector: string
    isExit: boolean
    parsedSelector: Selector
    listenerTypes: string[] | null
    attributeCount: number
    identifierCount: number
}

/**
* Gets the possible types of a selector
* @param parsedSelector An object (from esquery) describing the matching behavior of the selector
* @returns The node types that could possibly trigger this selector, or `null` if all node types could trigger it
*/
function getPossibleTypes(parsedSelector: Selector): string[] | null {
    switch (parsedSelector.type) {
        case "identifier":
            return [parsedSelector.value]

        case "matches": {
            const typesForComponents = parsedSelector.selectors.map(getPossibleTypes)

            if (typesForComponents.every(Boolean)) {
                return union(...(typesForComponents as string[][]))
            }
            return null
        }

        case "compound": {
            const typesForComponents = parsedSelector.selectors.map(getPossibleTypes).filter(Boolean) as string[][]

            // If all of the components could match any type, then the compound could also match any type.
            if (!typesForComponents.length) {
                return null
            }

            /*
             * If at least one of the components could only match a particular type, the compound could only match
             * the intersection of those types.
             */
            return intersection(...typesForComponents)
        }

        case "child":
        case "descendant":
        case "sibling":
        case "adjacent":
            return getPossibleTypes(parsedSelector.right)

        default:
            return null
    }
}

/**
 * Counts the number of class, pseudo-class, and attribute queries in this selector
 * @param parsedSelector An object (from esquery) describing the selector's matching behavior
 * @returns The number of class, pseudo-class, and attribute queries in this selector
 */
function countClassAttributes(parsedSelector: Selector): number {
    switch (parsedSelector.type) {
        case "child":
        case "descendant":
        case "sibling":
        case "adjacent":
            return countClassAttributes(parsedSelector.left) + countClassAttributes(parsedSelector.right)

        case "compound":
        case "not":
        case "matches":
            return parsedSelector.selectors.reduce((sum, childSelector) => sum + countClassAttributes(childSelector), 0)

        case "attribute":
        case "field":
        case "nth-child":
        case "nth-last-child":
            return 1

        default:
            return 0
    }
}

/**
 * Counts the number of identifier queries in this selector
 * @param parsedSelector An object (from esquery) describing the selector's matching behavior
 * @returns The number of identifier queries
 */
function countIdentifiers(parsedSelector: Selector): number {
    switch (parsedSelector.type) {
        case "child":
        case "descendant":
        case "sibling":
        case "adjacent":
            return countIdentifiers(parsedSelector.left) + countIdentifiers(parsedSelector.right)

        case "compound":
        case "not":
        case "matches":
            return parsedSelector.selectors.reduce((sum, childSelector) => sum + countIdentifiers(childSelector), 0)

        case "identifier":
            return 1

        default:
            return 0
    }
}

/**
 * Compares the specificity of two selector objects, with CSS-like rules.
 * @param selectorA An AST selector descriptor
 * @param selectorB Another AST selector descriptor
 * @returns
 * a value less than 0 if selectorA is less specific than selectorB
 * a value greater than 0 if selectorA is more specific than selectorB
 * a value less than 0 if selectorA and selectorB have the same specificity, and selectorA <= selectorB alphabetically
 * a value greater than 0 if selectorA and selectorB have the same specificity, and selectorA > selectorB alphabetically
 */
function compareSpecificity(selectorA: NodeSelector, selectorB: NodeSelector): number {
    return selectorA.attributeCount - selectorB.attributeCount ||
        selectorA.identifierCount - selectorB.identifierCount ||
        (selectorA.rawSelector <= selectorB.rawSelector ? -1 : 1)
}

/**
 * Parses a raw selector string, and throws a useful error if parsing fails.
 * @param rawSelector A raw AST selector
 * @returns An object (from esquery) describing the matching behavior of this selector
 * @throws An error if the selector is invalid
 */
function tryParseSelector(rawSelector: string): Selector {
    try {
        return esquery.parse(rawSelector.replace(/:exit$/, ""))
    }
    catch (err) {
        if (typeof err.offset === "number") {
            throw new Error(`Syntax error in selector "${rawSelector}" at position ${err.offset}: ${err.message}`)
        }
        throw err
    }
}

/**
 * Parses a raw selector string, and returns the parsed selector along with specificity and type information.
 * @param {string} rawSelector A raw AST selector
 * @returns {ASTSelector} A selector descriptor
 */
const parseSelector = memoize<(rawSelector: string) => NodeSelector>(rawSelector => {
    const parsedSelector = tryParseSelector(rawSelector)

    return {
        rawSelector,
        isExit: rawSelector.endsWith(":exit"),
        parsedSelector,
        listenerTypes: getPossibleTypes(parsedSelector),
        attributeCount: countClassAttributes(parsedSelector),
        identifierCount: countIdentifiers(parsedSelector),
    }
})

//------------------------------------------------------------------------------
// Public Interface
//------------------------------------------------------------------------------

/**
 * The event generator for AST nodes.
 * This implements below interface.
 *
 * ```ts
 * interface EventGenerator {
 *     emitter: EventEmitter
 *     enterNode(node: ASTNode): void
 *     leaveNode(node: ASTNode): void
 * }
 * ```
 */
export default class NodeEventGenerator {
    emitter: EventEmitter

    private currentAncestry: Node[]
    private enterSelectorsByNodeType: Map<string, NodeSelector[]>
    private exitSelectorsByNodeType: Map<string, NodeSelector[]>
    private anyTypeEnterSelectors: NodeSelector[]
    private anyTypeExitSelectors: NodeSelector[]

    /**
    * @param emitter - An event emitter which is the destination of events. This emitter must already
    * have registered listeners for all of the events that it needs to listen for.
    */
    constructor(emitter: EventEmitter) {
        this.emitter = emitter
        this.currentAncestry = []
        this.enterSelectorsByNodeType = new Map()
        this.exitSelectorsByNodeType = new Map()
        this.anyTypeEnterSelectors = []
        this.anyTypeExitSelectors = []

        const eventNames = typeof emitter.eventNames === "function"

            // Use the built-in eventNames() function if available (Node 6+)
            ? emitter.eventNames()

            /*
             * Otherwise, use the private _events property.
             * Using a private property isn't ideal here, but this seems to
             * be the best way to get a list of event names without overriding
             * addEventListener, which would hurt performance. This property
             * is widely used and unlikely to be removed in a future version
             * (see https://github.com/nodejs/node/issues/1817). Also, future
             * node versions will have eventNames() anyway.
             */
            : Object.keys((emitter as any)._events)

        for (const rawSelector of eventNames) {
            if (typeof rawSelector === "symbol") {
                continue
            }
            const selector = parseSelector(rawSelector)

            if (selector.listenerTypes) {
                for (const nodeType of selector.listenerTypes) {
                    const typeMap = selector.isExit ? this.exitSelectorsByNodeType : this.enterSelectorsByNodeType

                    let selectors = typeMap.get(nodeType)
                    if (selectors == null) {
                        typeMap.set(nodeType, (selectors = []))
                    }
                    selectors.push(selector)
                }
            }
            else {
                (selector.isExit ? this.anyTypeExitSelectors : this.anyTypeEnterSelectors).push(selector)
            }
        }

        this.anyTypeEnterSelectors.sort(compareSpecificity)
        this.anyTypeExitSelectors.sort(compareSpecificity)
        for (const selectorList of this.enterSelectorsByNodeType.values()) {
            selectorList.sort(compareSpecificity)
        }
        for (const selectorList of this.exitSelectorsByNodeType.values()) {
            selectorList.sort(compareSpecificity)
        }
    }

    /**
     * Checks a selector against a node, and emits it if it matches
     * @param node The node to check
     * @param selector An AST selector descriptor
     */
    private applySelector(node: Node, selector: NodeSelector): void {
        if (esquery.matches(node, selector.parsedSelector, this.currentAncestry)) {
            this.emitter.emit(selector.rawSelector, node)
        }
    }

    /**
     * Applies all appropriate selectors to a node, in specificity order
     * @param node The node to check
     * @param isExit `false` if the node is currently being entered, `true` if it's currently being exited
     */
    private applySelectors(node: Node, isExit: boolean): void {
        const selectorsByNodeType = (isExit ? this.exitSelectorsByNodeType : this.enterSelectorsByNodeType).get(node.type) || []
        const anyTypeSelectors = isExit ? this.anyTypeExitSelectors : this.anyTypeEnterSelectors

        /*
         * selectorsByNodeType and anyTypeSelectors were already sorted by specificity in the constructor.
         * Iterate through each of them, applying selectors in the right order.
         */
        let selectorsByTypeIndex = 0
        let anyTypeSelectorsIndex = 0

        while (selectorsByTypeIndex < selectorsByNodeType.length || anyTypeSelectorsIndex < anyTypeSelectors.length) {
            if (
                selectorsByTypeIndex >= selectorsByNodeType.length ||
                (anyTypeSelectorsIndex < anyTypeSelectors.length && compareSpecificity(anyTypeSelectors[anyTypeSelectorsIndex], selectorsByNodeType[selectorsByTypeIndex]) < 0)
            ) {
                this.applySelector(node, anyTypeSelectors[anyTypeSelectorsIndex++])
            }
            else {
                this.applySelector(node, selectorsByNodeType[selectorsByTypeIndex++])
            }
        }
    }

    /**
     * Emits an event of entering AST node.
     * @param node - A node which was entered.
     */
    enterNode(node: Node): void {
        if (node.parent) {
            this.currentAncestry.unshift(node.parent)
        }
        this.applySelectors(node, false)
    }

    /**
     * Emits an event of leaving AST node.
     * @param node - A node which was left.
     */
    leaveNode(node: Node): void {
        this.applySelectors(node, true)
        this.currentAncestry.shift()
    }
}
