import * as path from "path"
import type { VDocumentFragment } from "../ast"
import { getLang, isScriptElement, isScriptSetupElement } from "./ast-utils"

export interface ParserOptions {
    // vue-eslint-parser options
    parser?: boolean | string
    vueFeatures?: {
        interpolationAsNonHTML?: boolean // default false
        filter?: boolean // default true
    }

    // espree options
    ecmaVersion?: number | "latest"
    sourceType?: "script" | "module"
    ecmaFeatures?: { [key: string]: any }

    // @typescript-eslint/parser options
    jsxPragma?: string
    jsxFragmentName?: string | null
    lib?: string[]

    project?: string | string[]
    projectFolderIgnoreList?: string[]
    tsconfigRootDir?: string
    extraFileExtensions?: string[]
    warnOnUnsupportedTypeScriptVersion?: boolean

    // set by eslint
    filePath?: string
    // enables by eslint
    comment?: boolean
    loc?: boolean
    range?: boolean
    tokens?: boolean

    // others
    // [key: string]: any
}

export function isSFCFile(parserOptions: ParserOptions) {
    if (parserOptions.filePath === "<input>") {
        return true
    }
    return path.extname(parserOptions.filePath || "unknown.vue") === ".vue"
}

/**
 * Gets the script parser name from the given SFC document fragment.
 */
export function getScriptParser(
    parser: boolean | string | Record<string, string | undefined> | undefined,
    doc: VDocumentFragment | null,
    block: "script" | "template",
): string | undefined {
    if (parser && typeof parser === "object") {
        if (block === "template") {
            const parserForTemplate = parser["<template>"]
            if (typeof parserForTemplate === "string") {
                return parserForTemplate
            }
        }
        const lang = getScriptLang()
        if (lang) {
            const parserForLang = parser[lang]
            if (typeof parserForLang === "string") {
                return parserForLang
            }
        }
        return parser.js
    }
    return typeof parser === "string" ? parser : undefined

    function getScriptLang() {
        if (doc) {
            const scripts = doc.children.filter(isScriptElement)
            const script =
                scripts.length === 2
                    ? scripts.find(isScriptSetupElement)
                    : scripts[0]
            if (script) {
                return getLang(script)
            }
        }
        return null
    }
}
