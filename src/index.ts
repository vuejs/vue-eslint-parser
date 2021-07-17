/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import * as path from "path"
import * as AST from "./ast"
import { LocationCalculatorForHtml } from "./common/location-calculator"
import { HTMLParser, HTMLTokenizer } from "./html"
import { parseScript, parseScriptElement } from "./script"
import * as services from "./parser-services"
import type { ParserOptions } from "./common/parser-options"
import { getScriptParser } from "./common/parser-options"
import { parseScriptSetupElements } from "./script-setup"
import { LinesAndColumns } from "./common/lines-and-columns"
import type { VElement } from "./ast"
import { DEFAULT_ECMA_VERSION } from "./script-setup/parser-options"
import {
    getLang,
    isScriptElement,
    isScriptSetupElement,
    isStyleElement,
    isTemplateElement,
} from "./common/ast-utils"
import { parseStyleElements } from "./style"

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
    const options: ParserOptions = Object.assign(
        {
            comment: true,
            loc: true,
            range: true,
            tokens: true,
        },
        parserOptions || {},
    )

    let result: AST.ESLintExtendedProgram
    let document: AST.VDocumentFragment | null
    let locationCalculator: LocationCalculatorForHtml | null
    if (!isVueFile(code, options)) {
        result = parseScript(code, {
            ...options,
            ecmaVersion: options.ecmaVersion || DEFAULT_ECMA_VERSION,
            parser: getScriptParser(options.parser, null, "script"),
        })
        document = null
        locationCalculator = null
    } else {
        const optionsForTemplate = {
            ...options,
            ecmaVersion: options.ecmaVersion || DEFAULT_ECMA_VERSION,
        }
        const skipParsingScript = options.parser === false
        const tokenizer = new HTMLTokenizer(code, optionsForTemplate)
        const rootAST = new HTMLParser(tokenizer, optionsForTemplate).parse()

        locationCalculator = new LocationCalculatorForHtml(
            tokenizer.gaps,
            tokenizer.lineTerminators,
        )
        const scripts = rootAST.children.filter(isScriptElement)
        const template = rootAST.children.find(isTemplateElement)
        const templateLang = getLang(template) || "html"
        const concreteInfo: AST.HasConcreteInfo = {
            tokens: rootAST.tokens,
            comments: rootAST.comments,
            errors: rootAST.errors,
        }
        const templateBody =
            template != null && templateLang === "html"
                ? Object.assign(template, concreteInfo)
                : undefined

        const scriptParser = getScriptParser(options.parser, rootAST, "script")
        let scriptSetup: VElement | undefined
        if (skipParsingScript || !scripts.length) {
            result = parseScript("", {
                ...options,
                ecmaVersion: options.ecmaVersion || DEFAULT_ECMA_VERSION,
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
            result = parseScriptElement(scripts[0], locationCalculator, {
                ...options,
                parser: scriptParser,
            })
        }

        if (options.vueFeatures?.styleVariables ?? true) {
            const styles = rootAST.children.filter(isStyleElement)
            parseStyleElements(styles, locationCalculator, {
                ...options,
                parser: getScriptParser(options.parser, rootAST, "template"),
            })
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
