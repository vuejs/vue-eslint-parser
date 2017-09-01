/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */

export type Selector = AdjacentSelector | AttributeSelector | ChildSelector | ClassSelector | CompoundSelector | DescendantSelector | FieldSelector | HasSelector | IdentifierSelector | MatchesSelector | NotSelector | NthChildSelector | NthLastChildSelector | SiblingSelector | WildcardSelector

export interface AdjacentSelector {
    type: "adjacent"
    left: Selector
    right: Selector
}

export interface AttributeSelector {
    type: "attribute"
    name: string
    operator: string | null | undefined
    value: { type: string, value: any }
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
    index: { type: string, value: any }
}

export interface NthLastChildSelector {
    type: "nth-last-child"
    right: Selector
    index: { type: string, value: any }
}

export interface SiblingSelector {
    type: "sibling"
    left: Selector
    right: Selector
}

export interface WildcardSelector {
    type: "wildcard"
}

export declare function parse(query: string): Selector
export declare function matches(node: object, selector: Selector, ancestry: object[]): boolean
