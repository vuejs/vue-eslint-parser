/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */

import type { Node } from "../../src/ast"
// eslint-disable-next-line @mysticatea/node/no-missing-import
import type { VisitorKeys } from "../eslint-visitor-keys"

export type Selector =
    | AdjacentSelector
    | AttributeSelector
    | ChildSelector
    | ClassSelector
    | CompoundSelector
    | DescendantSelector
    | FieldSelector
    | HasSelector
    | IdentifierSelector
    | MatchesSelector
    | NotSelector
    | NthChildSelector
    | NthLastChildSelector
    | SiblingSelector
    | WildcardSelector

export type TraverseOptionFallback = (node: Node) => readonly string[]
export interface ESQueryOptions {
    visitorKeys?: VisitorKeys
    fallback?: TraverseOptionFallback
}

export interface AdjacentSelector {
    type: "adjacent"
    left: Selector
    right: Selector
}

export interface AttributeSelector {
    type: "attribute"
    name: string
    operator: string | null | undefined
    value: { type: string; value: any }
}

export interface ChildSelector {
    type: "child"
    left: Selector
    right: Selector
}

export interface ClassSelector {
    type: "class"
}

export interface CompoundSelector {
    type: "compound"
    selectors: Selector[]
}

export interface DescendantSelector {
    type: "descendant"
    left: Selector
    right: Selector
}

export interface FieldSelector {
    type: "field"
    name: string
}

export interface HasSelector {
    type: "has"
    selectors: Selector[]
}

export interface IdentifierSelector {
    type: "identifier"
    value: string
}

export interface MatchesSelector {
    type: "matches"
    selectors: Selector[]
}

export interface NotSelector {
    type: "not"
    selectors: Selector[]
}

export interface NthChildSelector {
    type: "nth-child"
    right: Selector
    index: { type: string; value: any }
}

export interface NthLastChildSelector {
    type: "nth-last-child"
    right: Selector
    index: { type: string; value: any }
}

export interface SiblingSelector {
    type: "sibling"
    left: Selector
    right: Selector
}

export interface WildcardSelector {
    type: "wildcard"
}

declare const esquery: {
    parse(query: string): Selector
    matches(
        node: object,
        selector: Selector,
        ancestry: object[],
        options?: ESQueryOptions,
    ): boolean
}
export default esquery
