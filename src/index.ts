/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import * as path from "path"
import * as AST from "./ast/index"
import { LocationCalculatorForHtml } from "./common/location-calculator"
import { HTMLParser, HTMLTokenizer } from "./html/index"
import { parseScript, parseScriptElement } from "./script/index"
import * as services from "./parser-services"
import type { ParserOptions } from "./common/parser-options"
import { getScriptParser, getParserLangFromSFC } from "./common/parser-options"
import { parseScriptSetupElements } from "./script-setup/index"
import { LinesAndColumns } from "./common/lines-and-columns"
import type { VElement } from "./ast/index"
import { DEFAULT_ECMA_VERSION } from "./script-setup/parser-options"
import {
    getLang,
    isScriptElement,
    isScriptSetupElement,
    isStyleElement,
    isTemplateElement,
} from "./common/ast-utils"
import { parseStyleElements } from "./style/index"
import { analyzeScope } from "./script/scope-analyzer"
import { analyzeScriptSetupScope } from "./script-setup/scope-analyzer"

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
 * Parse the given source code.
 * @param code The source code to parse.
 * @param parserOptions The parser options.
 * @returns The parsing result.
 */
export function parseForESLint(
    code: string,
    parserOptions: any,
): AST.ESLintExtendedProgram {
    const options: ParserOptions = {
        comment: true,
        loc: true,
        range: true,
        tokens: true,
        ...parserOptions,
    }

    let result: AST.ESLintExtendedProgram
    let document: AST.VDocumentFragment | null
    let locationCalculator: LocationCalculatorForHtml | null
    if (!isVueFile(code, options)) {
        result = parseAsScript(code, options)
        document = null
        locationCalculator = null
    } else {
        ;({ result, document, locationCalculator } = parseAsSFC(code, options))
    }

    result.services = {
        ...result.services,
        ...services.define(code, result.ast, document, locationCalculator, {
            parserOptions: options,
        }),
    }

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

// eslint-disable-next-line complexity -- ignore
function parseAsSFC(code: string, options: ParserOptions) {
    const optionsForTemplate = {
        ...options,
        ecmaVersion: options.ecmaVersion ?? DEFAULT_ECMA_VERSION,
    }
    const skipParsingScript = options.parser === false
    const tokenizer = new HTMLTokenizer(code, optionsForTemplate)
    const rootAST = new HTMLParser(tokenizer, optionsForTemplate).parse()

    const locationCalculator = new LocationCalculatorForHtml(
        tokenizer.gaps,
        tokenizer.lineTerminators,
    )
    const scripts = rootAST.children.filter(isScriptElement)
    const template = rootAST.children.find(isTemplateElement)
    const templateLang = getLang(template) || "html"
    const hasTemplateTokenizer = options?.templateTokenizer?.[templateLang]
    const concreteInfo: AST.HasConcreteInfo = {
        tokens: rootAST.tokens,
        comments: rootAST.comments,
        errors: rootAST.errors,
    }
    const templateBody =
        template != null && (templateLang === "html" || hasTemplateTokenizer)
            ? Object.assign(template, concreteInfo)
            : undefined

    const scriptParser = getScriptParser(options.parser, () =>
        getParserLangFromSFC(rootAST),
    )
    let result: AST.ESLintExtendedProgram
    let scriptSetup: VElement | undefined
    if (skipParsingScript || !scripts.length) {
        result = parseScript("", {
            ...options,
            ecmaVersion: options.ecmaVersion ?? DEFAULT_ECMA_VERSION,
            parser: scriptParser,
        })
    } else if (
        scripts.length === 2 &&
        (scriptSetup = scripts.find(isScriptSetupElement))
    ) {
        result = parseScriptSetupElements(
            scriptSetup,
            scripts.find((e) => e !== scriptSetup)!,
            code,
            new LinesAndColumns(tokenizer.lineTerminators),
            {
                ...options,
                parser: scriptParser,
            },
        )
    } else {
        result = parseScriptElement(
            scripts[0],
            code,
            new LinesAndColumns(tokenizer.lineTerminators),
            {
                ...options,
                parser: scriptParser,
            },
        )
    }

    if (options.vueFeatures?.styleCSSVariableInjection ?? true) {
        const styles = rootAST.children.filter(isStyleElement)
        parseStyleElements(styles, locationCalculator, {
            ...options,
            parser: getScriptParser(options.parser, function* () {
                yield "<template>"
                yield getParserLangFromSFC(rootAST)
            }),
            project: undefined,
            projectService: undefined,
        })
    }
    result.ast.templateBody = templateBody

    if (options.eslintScopeManager) {
        if (scripts.some(isScriptSetupElement)) {
            if (!result.scopeManager) {
                result.scopeManager = analyzeScope(result.ast, options)
            }
            analyzeScriptSetupScope(
                result.scopeManager,
                templateBody,
                rootAST,
                options,
            )
        }
    }

    return {
        result,
        locationCalculator,
        document: rootAST,
    }
}

function parseAsScript(code: string, options: ParserOptions) {
    return parseScript(code, {
        ...options,
        ecmaVersion: options.ecmaVersion ?? DEFAULT_ECMA_VERSION,
        parser: getScriptParser(options.parser, () => {
            const ext = (
                path.extname(options.filePath || "unknown.js").toLowerCase() ||
                ""
            )
                // remove dot
                .slice(1)
            if (/^[jt]sx$/u.test(ext)) {
                return [ext, ext.slice(0, -1)]
            }

            return ext
        }),
    })
}

export const meta = {
    name: "vue-eslint-parser",
    // eslint-disable-next-line no-process-env
    version: process.env.PACKAGE_VERSION,
}
