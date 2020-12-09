/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import * as path from "path"
import * as AST from "./ast"
import { LocationCalculator } from "./common/location-calculator"
import { HTMLParser, HTMLTokenizer } from "./html"
import { parseScript, parseScriptElement, parseScriptElements } from "./script"
import * as services from "./parser-services"
import type { ParserOptions } from "./common/parser-options"

const STARTS_WITH_LT = /^\s*</u

/**
 * Check whether the code is a Vue.js component.
 * @param code The source code to check.
 * @param options The parser options.
 * @returns `true` if the source code is a Vue.js component.
 */
function isVueFile(code: string, options: ParserOptions): boolean {
    const filePath = options.filePath || "unknown.js"
    return path.extname(filePath) === ".vue" || STARTS_WITH_LT.test(code)
}

/**
 * Check whether the node is a `<template>` element.
 * @param node The node to check.
 * @returns `true` if the node is a `<template>` element.
 */
function isTemplateElement(node: AST.VNode): node is AST.VElement {
    return node.type === "VElement" && node.name === "template"
}

/**
 * Check whether the node is a `<script>` element.
 * @param node The node to check.
 * @returns `true` if the node is a `<script>` element.
 */
function isScriptElement(node: AST.VNode): node is AST.VElement {
    return node.type === "VElement" && node.name === "script"
}

/**
 * Check whether the attribute node is a `lang` attribute.
 * @param attribute The attribute node to check.
 * @returns `true` if the attribute node is a `lang` attribute.
 */
function isLang(
    attribute: AST.VAttribute | AST.VDirective,
): attribute is AST.VAttribute {
    return attribute.directive === false && attribute.key.name === "lang"
}

/**
 * Get the `lang` attribute value from a given element.
 * @param element The element to get.
 * @param defaultLang The default value of the `lang` attribute.
 * @returns The `lang` attribute value.
 */
function getLang(
    element: AST.VElement | undefined,
    defaultLang: string,
): string {
    const langAttr = element && element.startTag.attributes.find(isLang)
    const lang = langAttr && langAttr.value && langAttr.value.value
    return lang || defaultLang
}

/**
 * Checks whether the given script element is `<script setup>`.
 */
function isScriptSetup(script: AST.VElement): boolean {
    return script.startTag.attributes.some(
        (attr) => !attr.directive && attr.key.name === "setup",
    )
}

/**
 * Parse the given source code.
 * @param code The source code to parse.
 * @param options The parser options.
 * @returns The parsing result.
 */
export function parseForESLint(
    code: string,
    options: any,
): AST.ESLintExtendedProgram {
    //eslint-disable-next-line no-param-reassign
    options = Object.assign(
        {
            comment: true,
            ecmaVersion: 2017,
            loc: true,
            range: true,
            tokens: true,
        },
        options || {},
    )

    let result: AST.ESLintExtendedProgram
    let document: AST.VDocumentFragment | null
    let locationCalculator: LocationCalculator | null
    if (!isVueFile(code, options)) {
        result = parseScript(code, options)
        document = null
        locationCalculator = null
    } else {
        const skipParsingScript = options.parser === false
        const tokenizer = new HTMLTokenizer(code, options)
        const rootAST = new HTMLParser(tokenizer, options).parse()

        locationCalculator = new LocationCalculator(
            tokenizer.gaps,
            tokenizer.lineTerminators,
        )
        const scripts = rootAST.children.filter(isScriptElement)
        const template = rootAST.children.find(isTemplateElement)
        const templateLang = getLang(template, "html")
        const concreteInfo: AST.HasConcreteInfo = {
            tokens: rootAST.tokens,
            comments: rootAST.comments,
            errors: rootAST.errors,
        }
        const templateBody =
            template != null && templateLang === "html"
                ? Object.assign(template, concreteInfo)
                : undefined

        if (skipParsingScript || !scripts.length) {
            result = parseScript("", options)
        } else if (
            scripts.length === 2 &&
            scripts.some(isScriptSetup) &&
            scripts.some((e) => !isScriptSetup(e))
        ) {
            result = parseScriptElements(
                scripts,
                code,
                new LocationCalculator([], tokenizer.lineTerminators),
                options,
            )
        } else {
            result = parseScriptElement(scripts[0], locationCalculator, options)
        }

        result.ast.templateBody = templateBody
        document = rootAST
    }

    result.services = Object.assign(
        result.services || {},
        services.define(code, result.ast, document, locationCalculator, {
            parserOptions: options,
        }),
    )

    return result
}

/**
 * Parse the given source code.
 * @param code The source code to parse.
 * @param options The parser options.
 * @returns The parsing result.
 */
export function parse(code: string, options: any): AST.ESLintProgram {
    return parseForESLint(code, options).ast
}

export { AST }
