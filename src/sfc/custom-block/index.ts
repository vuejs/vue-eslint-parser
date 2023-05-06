import type { Rule, SourceCode } from "eslint"
import type { ScopeManager, Scope } from "eslint-scope"
import type {
    ESLintExtendedProgram,
    Node,
    OffsetRange,
    VDocumentFragment,
    VElement,
    VExpressionContainer,
    VText,
} from "../../ast"
import { getFallbackKeys, ParseError } from "../../ast"
import { getEslintScope } from "../../common/eslint-scope"
import { getEcmaVersionIfUseEspree } from "../../common/espree"
import { fixErrorLocation, fixLocations } from "../../common/fix-locations"
import type { LocationCalculatorForHtml } from "../../common/location-calculator"
import type { ParserObject } from "../../common/parser-object"
import { isEnhancedParserObject } from "../../common/parser-object"
import type { ParserOptions } from "../../common/parser-options"
import { DEFAULT_ECMA_VERSION } from "../../script-setup/parser-options"

export type ESLintCustomBlockParser = ParserObject<any, any>

export type CustomBlockContext = {
    getSourceCode(): SourceCode
    sourceCode: SourceCode
    parserServices: any
    getAncestors(): any[]
    getDeclaredVariables(node: any): any[]
    getScope(): any
    markVariableAsUsed(name: string): boolean

    // Same as the original context.
    id: string
    options: any[]
    settings: { [name: string]: any }
    parserPath: string
    parserOptions: any
    getFilename(): string
    report(descriptor: Rule.ReportDescriptor): void
}

/**
 * Checks whether the given node is VElement.
 */
function isVElement(
    node: VElement | VExpressionContainer | VText,
): node is VElement {
    return node.type === "VElement"
}

/**
 * Get the all custom blocks from given document
 * @param document
 */
export function getCustomBlocks(
    document: VDocumentFragment | null,
): VElement[] {
    return document
        ? document.children
              .filter(isVElement)
              .filter(
                  (block) =>
                      block.name !== "script" &&
                      block.name !== "template" &&
                      block.name !== "style",
              )
        : []
}

/**
 * Parse the source code of the given custom block element.
 * @param node The custom block element to parse.
 * @param parser The custom parser.
 * @param globalLocationCalculator The location calculator for fixLocations.
 * @param parserOptions The parser options.
 * @returns The result of parsing.
 */
export function parseCustomBlockElement(
    node: VElement,
    parser: ESLintCustomBlockParser,
    globalLocationCalculator: LocationCalculatorForHtml,
    parserOptions: ParserOptions,
): ESLintExtendedProgram & { error?: ParseError | Error } {
    const text = node.children[0]
    const { code, range, loc } =
        text != null && text.type === "VText"
            ? {
                  code: text.value,
                  range: text.range,
                  loc: text.loc,
              }
            : {
                  code: "",
                  range: [
                      node.startTag.range[1],
                      node.endTag!.range[0],
                  ] as OffsetRange,
                  loc: {
                      start: node.startTag.loc.end,
                      end: node.endTag!.loc.start,
                  },
              }
    const locationCalculator = globalLocationCalculator.getSubCalculatorAfter(
        range[0],
    )
    try {
        return parseCustomBlockFragment(
            code,
            parser,
            locationCalculator,
            parserOptions,
        )
    } catch (e) {
        if (!(e instanceof Error)) {
            throw e
        }
        return {
            error: e,
            ast: {
                type: "Program",
                sourceType: "module",
                loc: {
                    start: {
                        ...loc.start,
                    },
                    end: {
                        ...loc.end,
                    },
                },
                range: [...range],
                body: [],
                tokens: [],
                comments: [],
            },
        }
    }
}

/**
 * Parse the given source code.
 *
 * @param code The source code to parse.
 * @param parser The custom parser.
 * @param locationCalculator The location calculator for fixLocations.
 * @param parserOptions The parser options.
 * @returns The result of parsing.
 */
function parseCustomBlockFragment(
    code: string,
    parser: ESLintCustomBlockParser,
    locationCalculator: LocationCalculatorForHtml,
    parserOptions: ParserOptions,
): ESLintExtendedProgram {
    try {
        const result = parseBlock(code, parser, {
            ecmaVersion: DEFAULT_ECMA_VERSION,
            loc: true,
            range: true,
            raw: true,
            tokens: true,
            comment: true,
            eslintVisitorKeys: true,
            eslintScopeManager: true,
            ...parserOptions,
        })
        fixLocations(result, locationCalculator)
        return result
    } catch (err) {
        const perr = ParseError.normalize(err)
        if (perr) {
            fixErrorLocation(perr, locationCalculator)
            throw perr
        }
        throw err
    }
}

function parseBlock(
    code: string,
    parser: ESLintCustomBlockParser,
    parserOptions: any,
): any {
    const result = isEnhancedParserObject(parser)
        ? parser.parseForESLint(code, parserOptions)
        : parser.parse(code, parserOptions)

    if (result.ast != null) {
        return result
    }
    return { ast: result }
}

/**
 * Create shared context.
 *
 * @param text The source code of SFC.
 * @param customBlock The custom block node.
 * @param parsedResult The parse result data
 * @param parserOptions The parser options.
 */
export function createCustomBlockSharedContext({
    text,
    customBlock,
    parsedResult,
    globalLocationCalculator,
    parserOptions,
}: {
    text: string
    customBlock: VElement
    parsedResult: ESLintExtendedProgram & { error?: ParseError | Error }
    globalLocationCalculator: LocationCalculatorForHtml
    parserOptions: any
}) {
    let sourceCode: SourceCode
    let scopeManager: ScopeManager
    let currentNode: any
    return {
        serCurrentNode(node: any) {
            currentNode = node
        },
        context: {
            getAncestors: () => getAncestors(currentNode),

            getDeclaredVariables: (...args: any[]) =>
                // @ts-expect-error -- ignore
                getScopeManager().getDeclaredVariables(...args),
            getScope: () => getScope(getScopeManager(), currentNode),
            markVariableAsUsed: (name: string) =>
                markVariableAsUsed(
                    getScopeManager(),
                    currentNode,
                    parserOptions,
                    name,
                ),
            parserServices: {
                customBlock,
                parseCustomBlockElement(
                    parser: ESLintCustomBlockParser,
                    options: any,
                ) {
                    return parseCustomBlockElement(
                        customBlock,
                        parser,
                        globalLocationCalculator,
                        { ...parserOptions, ...options },
                    )
                },
                ...(parsedResult.services || {}),
                ...(parsedResult.error
                    ? { parseError: parsedResult.error }
                    : {}),
            },
            getSourceCode,
            get sourceCode() {
                return getSourceCode()
            },
        },
    }

    function getSourceCode() {
        return (
            sourceCode ||
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            (sourceCode = new (require("eslint").SourceCode)({
                text,
                ast: parsedResult.ast,
                parserServices: parsedResult.services,
                scopeManager: getScopeManager(),
                visitorKeys: parsedResult.visitorKeys,
            }))
        )
    }

    function getScopeManager() {
        if (parsedResult.scopeManager || scopeManager) {
            return parsedResult.scopeManager || scopeManager
        }

        const ecmaVersion = getEcmaVersionIfUseEspree(parserOptions) || 2022
        const ecmaFeatures = parserOptions.ecmaFeatures || {}
        const sourceType = parserOptions.sourceType || "script"
        scopeManager = getEslintScope().analyze(parsedResult.ast, {
            ignoreEval: true,
            nodejsScope: false,
            impliedStrict: ecmaFeatures.impliedStrict,
            ecmaVersion,
            sourceType,
            fallback: getFallbackKeys,
        })
        return scopeManager
    }
}

/* The following source code is copied from `eslint/lib/linter/linter.js` */

/**
 * Gets all the ancestors of a given node
 * @param {ASTNode} node The node
 * @returns {ASTNode[]} All the ancestor nodes in the AST, not including the provided node, starting
 * from the root node and going inwards to the parent node.
 */
function getAncestors(node: Node) {
    const ancestorsStartingAtParent = []

    for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
        ancestorsStartingAtParent.push(ancestor)
    }

    return ancestorsStartingAtParent.reverse()
}

/**
 * Gets the scope for the current node
 * @param {ScopeManager} scopeManager The scope manager for this AST
 * @param {ASTNode} currentNode The node to get the scope of
 * @returns {eslint-scope.Scope} The scope information for this node
 */
function getScope(scopeManager: ScopeManager, currentNode: Node) {
    // On Program node, get the outermost scope to avoid return Node.js special function scope or ES modules scope.
    const inner = currentNode.type !== "Program"

    for (
        let node: Node | null = currentNode;
        node;
        node = node.parent || null
    ) {
        const scope = scopeManager.acquire(node as any, inner)

        if (scope) {
            if (scope.type === "function-expression-name") {
                return scope.childScopes[0]
            }
            return scope
        }
    }

    return scopeManager.scopes[0]
}

/**
 * Marks a variable as used in the current scope
 * @param {ScopeManager} scopeManager The scope manager for this AST. The scope may be mutated by this function.
 * @param {ASTNode} currentNode The node currently being traversed
 * @param {Object} parserOptions The options used to parse this text
 * @param {string} name The name of the variable that should be marked as used.
 * @returns {boolean} True if the variable was found and marked as used, false if not.
 */
function markVariableAsUsed(
    scopeManager: ScopeManager,
    currentNode: Node,
    parserOptions: any,
    name: string,
) {
    const hasGlobalReturn =
        parserOptions.ecmaFeatures && parserOptions.ecmaFeatures.globalReturn
    const specialScope =
        hasGlobalReturn || parserOptions.sourceType === "module"
    const currentScope = getScope(scopeManager, currentNode)

    // Special Node.js scope means we need to start one level deeper
    const initialScope =
        currentScope.type === "global" && specialScope
            ? currentScope.childScopes[0]
            : currentScope

    for (let scope: Scope | null = initialScope; scope; scope = scope.upper) {
        const variable = scope.variables.find(
            (scopeVar) => scopeVar.name === name,
        )

        if (variable) {
            // @ts-expect-error -- ignore
            variable.eslintUsed = true
            return true
        }
    }

    return false
}
