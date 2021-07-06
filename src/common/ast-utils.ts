import type { VAttribute, VDirective, VElement, VNode } from "../ast"

/**
 * Check whether the node is a `<script>` element.
 * @param node The node to check.
 * @returns `true` if the node is a `<script>` element.
 */
export function isScriptElement(node: VNode): node is VElement {
    return node.type === "VElement" && node.name === "script"
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
    const langAttr = element && element.startTag.attributes.find(isLang)
    const lang = langAttr && langAttr.value && langAttr.value.value
    return lang || null
}
