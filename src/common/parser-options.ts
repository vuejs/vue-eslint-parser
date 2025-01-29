import * as path from "path"
import type { VDocumentFragment } from "../ast/index"
import type { CustomTemplateTokenizerConstructor } from "../html/custom-tokenizer"
import { getLang, isScriptElement, isScriptSetupElement } from "./ast-utils"
import type { ParserObject } from "./parser-object"
import { isParserObject } from "./parser-object"

export interface ParserOptions {
    // vue-eslint-parser options
    parser?:
        | boolean
        | string
        | ParserObject
        | Record<string, string | ParserObject | undefined>
    vueFeatures?: {
        interpolationAsNonHTML?: boolean // default true
        filter?: boolean // default true
        styleCSSVariableInjection?: boolean // default true
        customMacros?: string[]
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
    projectService?: boolean | ProjectServiceOptions
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

    // From ESLint
    eslintScopeManager?: boolean

    // others
    // [key: string]: any

    templateTokenizer?: Record<
        string,
        string | CustomTemplateTokenizerConstructor | undefined
    >
}

interface ProjectServiceOptions {
    allowDefaultProject?: string[]
    defaultProject?: string
    loadTypeScriptPlugins?: boolean
    maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING?: number
}

export function isSFCFile(parserOptions: ParserOptions) {
    if (parserOptions.filePath === "<input>") {
        return true
    }
    return path.extname(parserOptions.filePath || "unknown.vue") === ".vue"
}

/**
 * Gets the script parser name from the given parser lang.
 */
export function getScriptParser(
    parser:
        | boolean
        | string
        | ParserObject
        | Record<string, string | ParserObject | undefined>
        | undefined,
    getParserLang: () => string | null | Iterable<string | null>,
): string | ParserObject | undefined {
    if (isParserObject(parser)) {
        return parser
    }
    if (parser && typeof parser === "object") {
        const parserLang = getParserLang()
        const parserLangs =
            parserLang == null
                ? []
                : typeof parserLang === "string"
                  ? [parserLang]
                  : parserLang
        for (const lang of parserLangs) {
            const parserForLang = lang && parser[lang]
            if (
                typeof parserForLang === "string" ||
                isParserObject(parserForLang)
            ) {
                return parserForLang
            }
        }
        return parser.js
    }
    return typeof parser === "string" ? parser : undefined
}

export function getParserLangFromSFC(doc: VDocumentFragment): string | null {
    if (doc) {
        const scripts = doc.children.filter(isScriptElement)
        const script =
            (scripts.length === 2 && scripts.find(isScriptSetupElement)) ||
            scripts[0]
        if (script) {
            return getLang(script)
        }
    }
    return null
}
