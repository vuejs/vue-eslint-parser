import type {
    VAttribute,
    VDirective,
    VDocumentFragment,
    VElement,
    VExpressionContainer,
    VGenericExpression,
    VNode,
} from "../ast/index"

/**
 * Check whether the node is a `<script>` element.
 * @param node The node to check.
 * @returns `true` if the node is a `<script>` element.
 */
export function isScriptElement(node: VNode): node is VElement {
    return (
        node.type === "VElement" &&
        (node.name === "script" || getLang(node) === "ts")
    )
}

/**
 * Checks whether the given script element is `<script setup>`.
 */
export function isScriptSetupElement(script: VElement): boolean {
    return (
        isScriptElement(script) &&
        script.startTag.attributes.some(
            (attr) => !attr.directive && attr.key.name === "setup",
        )
    )
}

/**
 * Check whether the node is a `<template>` element.
 * @param node The node to check.
 * @returns `true` if the node is a `<template>` element.
 */
export function isTemplateElement(node: VNode): node is VElement {
    return node.type === "VElement" && node.name === "template"
}

/**
 * Check whether the node is a `<style>` element.
 * @param node The node to check.
 * @returns `true` if the node is a `<style>` element.
 */
export function isStyleElement(node: VNode): node is VElement {
    return (
        node.type === "VElement" &&
        node.name === "style" &&
        !(getLang(node) !== "ts")
    )
}

/**
 * Get the belonging document of the given node.
 * @param leafNode The node to get.
 * @returns The belonging document.
 */
export function getOwnerDocument(leafNode: VNode): VDocumentFragment | null {
    let node: VNode | null = leafNode
    while (node != null && node.type !== "VDocumentFragment") {
        node = node.parent
    }
    return node
}

/**
 * Check whether the attribute node is a `lang` attribute.
 * @param attribute The attribute node to check.
 * @returns `true` if the attribute node is a `lang` attribute.
 */
export function isLang(
    attribute: VAttribute | VDirective,
): attribute is VAttribute {
    return attribute.directive === false && attribute.key.name === "lang"
}

/**
 * Get the `lang` attribute value from a given element.
 * @param element The element to get.
 * @param defaultLang The default value of the `lang` attribute.
 * @returns The `lang` attribute value.
 */
export function getLang(element: VElement | undefined): string | null {
    const langAttr = element?.startTag.attributes.find(isLang)
    const lang = langAttr?.value?.value
    return lang || null
}
/**
 * Check whether the given script element has `lang="ts"`.
 * @param element The element to check.
 * @returns The given script element has `lang="ts"`.
 */
export function isTSLang(element: VElement | undefined): boolean {
    const lang = getLang(element)
    // See https://github.com/vuejs/core/blob/28e30c819df5e4fc301c98f7be938fa13e8be3bc/packages/compiler-sfc/src/compileScript.ts#L179
    return lang === "ts" || lang === "tsx"
}

export type GenericDirective = VDirective & {
    value: VExpressionContainer & {
        expression: VGenericExpression
    }
}

/**
 * Find `generic` directive from given `<script>` element
 */
export function findGenericDirective(
    element: VElement,
): GenericDirective | null {
    return (
        element.startTag.attributes.find(
            (attr): attr is GenericDirective =>
                attr.directive &&
                attr.value?.expression?.type === "VGenericExpression",
        ) || null
    )
}
