/**
 * @author Yosuke Ota <https://github.com/ota-meshi>
 * See LICENSE file in root directory for full license.
 */
import type { ScopeManager, Scope } from "eslint-scope"
import type {
    ESLintBlockStatement,
    ESLintExportNamedDeclaration,
    ESLintExportSpecifier,
    ESLintExtendedProgram,
    ESLintIdentifier,
    ESLintModuleDeclaration,
    ESLintNode,
    ESLintProgram,
    ESLintStatement,
    Token,
    VElement,
} from "../ast/index"
import { ParseError, traverseNodes } from "../ast/index"
import {
    fixErrorLocation,
    fixLocation,
    fixLocations,
    fixNodeLocations,
} from "../common/fix-locations"
import type { LinesAndColumns } from "../common/lines-and-columns"
import type { LocationCalculator } from "../common/location-calculator"
import type { ParserOptions } from "../common/parser-options"
import {
    parseScript as parseScriptBase,
    parseScriptFragment,
} from "../script/index"
import { extractGeneric } from "../script/generic"
import { DEFAULT_ECMA_VERSION } from "./parser-options"

type RemapBlock = {
    range: [number, number]
    offset: number
}

/**
 * `parseScriptSetupElements` rewrites the source code so that it can parse
 * the combination of `<script>` and `<script setup>`, and parses it source code with JavaScript parser.
 * This class holds the information to restore the AST and token locations parsed in the rewritten source code.
 */
class CodeBlocks {
    public code: string
    // The location information for remapping.
    public remapBlocks: RemapBlock[] = []
    // The list of extra punctuation locations added to split the statement.
    public splitPunctuators: number[] = []

    public constructor() {
        this.code = ""
    }
    public get length() {
        return this.code.length
    }
    public append(codeLet: string, originalOffset: number) {
        const rangeStart = this.code.length
        this.code += codeLet.trimEnd()
        this.remapBlocks.push({
            range: [rangeStart, this.code.length],
            offset: originalOffset - rangeStart,
        })
    }
    public appendSplitPunctuators(punctuator: string) {
        this.splitPunctuators.push(this.code.length, this.code.length + 1)
        this.code += `\n${punctuator}\n`
    }
    public appendCodeBlocks(codeBlocks: CodeBlocks) {
        const start = this.code.length
        this.code += codeBlocks.code
        this.remapBlocks.push(
            ...codeBlocks.remapBlocks.map(
                (b): RemapBlock => ({
                    range: [b.range[0] + start, b.range[1] + start],
                    offset: b.offset - start,
                }),
            ),
        )
        this.splitPunctuators.push(
            ...codeBlocks.splitPunctuators.map((s) => s + start),
        )
    }
}

type RestoreASTCallback = (node: ESLintStatement) => {
    statement: ESLintStatement | ESLintModuleDeclaration
    tokens: Token[]
} | null
/**
 * Some named exports need to be replaced with a different syntax to successfully parse
 * the combination of `<script>` and `<script setup>`.
 * e.g. `export {a,b}` -> `({a,b});`, `export let a` -> `let a`
 * This class holds the callbacks to restore the rewritten syntax AST back to the original `export` AST.
 */
class RestoreASTCallbacks {
    private callbacks: {
        range: [number, number]
        callback: RestoreASTCallback
    }[] = []
    public addCallback(
        originalOffsetStart: number,
        range: [number, number],
        callback: RestoreASTCallback,
    ) {
        this.callbacks.push({
            range: [
                originalOffsetStart + range[0],
                originalOffsetStart + range[1],
            ],
            callback,
        })
    }
    public restore(
        program: ESLintProgram,
        scriptSetupStatements: ESLintStatement[],
        linesAndColumns: LinesAndColumns,
    ) {
        if (this.callbacks.length === 0) {
            return
        }
        const callbacks = new Set(this.callbacks)
        for (const statement of scriptSetupStatements) {
            for (const cb of callbacks) {
                if (
                    cb.range[0] <= statement.range[0] &&
                    statement.range[1] <= cb.range[1]
                ) {
                    const restored = cb.callback(statement)
                    if (restored) {
                        const removeIndex = program.body.indexOf(statement)
                        if (removeIndex >= 0) {
                            program.body.splice(removeIndex, 1)
                            program.body.push(restored.statement)
                            program.tokens!.push(...restored.tokens)
                            restored.statement.parent = program
                            callbacks.delete(cb)
                            break
                        }
                    }
                }
            }
        }
        if (callbacks.size) {
            const [cb] = callbacks
            const loc = linesAndColumns.getLocFromIndex(cb.range[0])
            throw new ParseError(
                "Could not parse <script setup>. Failed to restore ExportNamedDeclaration.",
                undefined,
                cb.range[0],
                loc.line,
                loc.column,
            )
        }
    }
}

type Postprocess = (
    result: ESLintExtendedProgram,
    context: { scriptSetupBlockRange: [number, number] },
) => void

type ScriptSetupCodeBlocks = {
    codeBlocks: CodeBlocks
    // The location of the code of the statements in `<script setup>`.
    scriptSetupBlockRange: [number, number]
    // Post process
    postprocess: Postprocess
    // Used to restore ExportNamedDeclaration.
    restoreASTCallbacks: RestoreASTCallbacks
}
type ScriptSetupModuleCodeBlocks =
    | ScriptSetupCodeBlocks
    | {
          codeBlocks: CodeBlocks
          scriptSetupBlockRange?: undefined
          postprocess?: undefined
          restoreASTCallbacks?: undefined
      }

function parseScript(
    code: string,
    parserOptions: ParserOptions,
    locationCalculatorForError: LocationCalculator,
) {
    try {
        return parseScriptBase(code, parserOptions)
    } catch (err) {
        const perr = ParseError.normalize(err)
        if (perr) {
            // console.log(code)
            fixErrorLocation(perr, locationCalculatorForError)
            throw perr
        }
        throw err
    }
}

/**
 * Parse the source code of the given `<script setup>` and `<script>` elements.
 * @param scriptSetupElement The `<script setup>` element to parse.
 * @param nodes The `<script>` elements to parse.
 * @param sfcCode The source code of SFC.
 * @param linesAndColumns The lines and columns location calculator.
 * @param parserOptions The parser options.
 * @returns The result of parsing.
 */
export function parseScriptSetupElements(
    scriptSetupElement: VElement,
    scriptElements: VElement[],
    sfcCode: string,
    linesAndColumns: LinesAndColumns,
    originalParserOptions: ParserOptions,
): ESLintExtendedProgram {
    const parserOptions: ParserOptions = {
        ...originalParserOptions,
        ecmaVersion: originalParserOptions.ecmaVersion ?? DEFAULT_ECMA_VERSION,
    }
    const scriptSetupModuleCodeBlocks = getScriptSetupModuleCodeBlocks(
        scriptSetupElement,
        scriptElements,
        sfcCode,
        linesAndColumns,
        parserOptions,
    )
    if (!scriptSetupModuleCodeBlocks) {
        return parseScriptFragment(
            "",
            linesAndColumns.createOffsetLocationCalculator(
                scriptSetupElement.startTag.range[1],
            ),
            parserOptions,
        )
    }

    const locationCalculator: LocationCalculator = {
        getFixOffset(offset, kind) {
            const test: (block: RemapBlock) => boolean =
                kind === "start"
                    ? (block) =>
                          block.range[0] <= offset && offset < block.range[1]
                    : (block) =>
                          block.range[0] < offset && offset <= block.range[1]

            for (const block of scriptSetupModuleCodeBlocks.codeBlocks
                .remapBlocks) {
                if (test(block)) {
                    return block.offset
                }
            }
            return offset
        },
        getLocFromIndex: linesAndColumns.getLocFromIndex.bind(linesAndColumns),
    }

    const result = parseScript(
        scriptSetupModuleCodeBlocks.codeBlocks.code,
        parserOptions,
        locationCalculator,
    )
    if (scriptSetupModuleCodeBlocks.postprocess) {
        scriptSetupModuleCodeBlocks.postprocess(result, {
            scriptSetupBlockRange:
                scriptSetupModuleCodeBlocks.scriptSetupBlockRange,
        })
    }

    /* Remap ASTs */
    const scriptSetupStatements = remapAST(result, scriptSetupModuleCodeBlocks)

    /* Remap locations */
    remapLocationAndTokens(
        result,
        scriptSetupModuleCodeBlocks,
        locationCalculator,
    )

    if (scriptSetupModuleCodeBlocks.restoreASTCallbacks) {
        scriptSetupModuleCodeBlocks.restoreASTCallbacks.restore(
            result.ast,
            scriptSetupStatements,
            linesAndColumns,
        )
    }

    // Adjust AST and tokens
    if (result.ast.tokens != null) {
        for (const node of [scriptSetupElement, ...scriptElements]) {
            const startTag = node.startTag
            const endTag = node.endTag

            result.ast.tokens.unshift({
                type: "Punctuator",
                range: startTag.range,
                loc: startTag.loc,
                value: "<script>",
            })
            if (endTag != null) {
                result.ast.tokens.push({
                    type: "Punctuator",
                    range: endTag.range,
                    loc: endTag.loc,
                    value: "</script>",
                })
            }
        }
        result.ast.tokens.sort((a, b) => a.range[0] - b.range[0])
    }

    if (result.ast.comments != null) {
        result.ast.comments.sort((a, b) => a.range[0] - b.range[0])
    }
    result.ast.body.sort((a, b) => a.range[0] - b.range[0])

    const programStartOffset = result.ast.body.reduce(
        (start, node) => Math.min(start, node.range[0]),
        result.ast.range[0],
    )
    result.ast.range[0] = programStartOffset
    result.ast.loc.start =
        locationCalculator.getLocFromIndex(programStartOffset)
    if (result.ast.start != null) {
        result.ast.start = [scriptSetupElement, ...scriptElements].reduce(
            (start, node) => {
                const textNode = node.children[0]
                return Math.min(
                    start,
                    textNode?.type === "VText"
                        ? textNode.range[0]
                        : node.startTag.range[1],
                )
            },
            result.ast.start,
        )
    }

    const programEndOffset = result.ast.body.reduce(
        (end, node) => Math.max(end, node.range[1]),
        0,
    )
    result.ast.range[1] = programEndOffset
    result.ast.loc.end = locationCalculator.getLocFromIndex(programEndOffset)
    if (result.ast.end != null) {
        result.ast.end = [scriptSetupElement, ...scriptElements].reduce(
            (end, node) => {
                const textNode = node.children[0]
                return Math.max(
                    end,
                    textNode?.type === "VText"
                        ? textNode.range[1]
                        : (node.endTag?.range[0] ?? node.range[1]),
                )
            },
            0,
        )
    }

    return result
}

/**
 * Parses the scripts of the given `<script>` elements and returns
 * the reconstructed source code as a parseable script.
 * It also returns information for remapping the location.
 *
 * For examples, the script is reconstructed as follows.
 *
 * Example 1:
 *
 * ```vue
 * <script>
 * export let count = 42
 * </script>
 * <script setup>
 * import MyComponent from './MyComponent.vue'
 * let count = 42
 * </script>
 * ```
 *
 * ↓
 *
 * ```js
 * export let count = 42
 * ;
 * import MyComponent from './MyComponent.vue';
 * {
 * let count = 42
 * }
 * ```
 *
 * Example 2:
 *
 * ```vue
 * <script>
 * export let count = 42
 * </script>
 * <script setup>
 * import MyComponent1 from './MyComponent1.vue'
 * let count = 42
 * import MyComponent2 from './MyComponent2.vue'
 * let a
 * </script>
 * ```
 *
 * ↓
 *
 * ```js
 * export let count = 42
 * ;
 * import MyComponent1 from './MyComponent1.vue';
 * import MyComponent2 from './MyComponent2.vue';
 * {
 * let count = 42;
 * let a
 * }
 * ```
 *
 * Example 3:
 *
 * ```vue
 * <script>
 * export let count = 42
 * export let count2 = 42
 * </script>
 * <script setup>
 * import MyComponent1 from './MyComponent1.vue'
 * let count = 42
 * export {count as ns}
 * export let count2 = 42
 * count2++
 * </script>
 * ```
 *
 * ↓
 *
 * ```js
 * export let count = 42
 * export let count2 = 42
 * ;
 * import MyComponent1 from './MyComponent1.vue';
 * {
 * let count = 42;
 * let a
 * ;
 * ({count})
 * ;
 * let count2 = 42
 * ;
 * count2++
 * ;
 * }
 * ```
 */
function getScriptSetupModuleCodeBlocks(
    scriptSetupElement: VElement,
    scriptElements: VElement[],
    sfcCode: string,
    linesAndColumns: LinesAndColumns,
    parserOptions: ParserOptions,
): ScriptSetupModuleCodeBlocks | null {
    const scriptSetupCodeBlocks = getScriptSetupCodeBlocks(
        scriptSetupElement,
        sfcCode,
        linesAndColumns,
        parserOptions,
    )

    const codeBlocks = new CodeBlocks()

    for (const scriptElement of scriptElements) {
        const textNode = scriptElement.children[0]
        if (textNode == null || textNode.type !== "VText") {
            continue
        }

        const [scriptStartOffset, scriptEndOffset] = textNode.range

        codeBlocks.append(
            sfcCode.slice(scriptStartOffset, scriptEndOffset),
            scriptStartOffset,
        )
    }

    if (scriptSetupCodeBlocks == null) {
        return { codeBlocks }
    }

    codeBlocks.appendSplitPunctuators(";")
    const scriptSetupOffset = codeBlocks.length
    codeBlocks.appendCodeBlocks(scriptSetupCodeBlocks.codeBlocks)

    return {
        codeBlocks,
        scriptSetupBlockRange: [
            scriptSetupCodeBlocks.scriptSetupBlockRange[0] + scriptSetupOffset,
            scriptSetupCodeBlocks.scriptSetupBlockRange[1] + scriptSetupOffset,
        ],
        postprocess: scriptSetupCodeBlocks.postprocess,
        restoreASTCallbacks: scriptSetupCodeBlocks.restoreASTCallbacks,
    }
}

/**
 * Parses the script in the given `<script setup>` and returns the source code with
 * the import blocks and other statements reconstructed.
 * It also returns information for remapping the location.
 */
function getScriptSetupCodeBlocks(
    node: VElement,
    sfcCode: string,
    linesAndColumns: LinesAndColumns,
    parserOptions: ParserOptions,
): ScriptSetupCodeBlocks | null {
    const textNode = node.children[0]
    if (textNode == null || textNode.type !== "VText") {
        return null
    }

    const [scriptSetupStartOffset, scriptSetupEndOffset] = textNode.range
    const scriptCode = sfcCode.slice(
        scriptSetupStartOffset,
        scriptSetupEndOffset,
    )

    const offsetLocationCalculator =
        linesAndColumns.createOffsetLocationCalculator(scriptSetupStartOffset)

    const { ast, visitorKeys } = parseScript(
        scriptCode,
        { ...parserOptions, project: undefined, projectService: undefined },
        offsetLocationCalculator,
    )

    // Holds the `import` and re-`export` statements.
    // All import and re-`export` statements are hoisted to the top.
    const importCodeBlocks = new CodeBlocks()
    // Holds statements other than `import`, re-`export` and `export default` statements.
    // This is moved to a block statement to avoid conflicts with variables of the same name in `<script>`.
    const statementCodeBlocks = new CodeBlocks()
    // Holds `export default` statements.
    // All `export default` statements are move to the bottom.
    const exportDefaultCodeBlocks = new CodeBlocks()
    // It holds the information to restore the transformation source code of the export statements held in `statementCodeBlocks`.
    const restoreASTCallbacks = new RestoreASTCallbacks()

    let usedOffset = 0

    /**
     * Consume and append the given range of code to the given codeBlocks.
     */
    function append(codeBlocks: CodeBlocks, start: number, end: number) {
        if (start < end) {
            codeBlocks.append(
                scriptCode.slice(start, end),
                scriptSetupStartOffset + start,
            )
            usedOffset = end
            return true
        }
        return false
    }

    /**
     * Append the given range of import or export statement to the given codeBlocks.
     */
    function appendRangeAsStatement(
        codeBlocks: CodeBlocks,
        start: number,
        end: number,
    ) {
        if (append(codeBlocks, start, end)) {
            codeBlocks.appendSplitPunctuators(";")
        }
    }

    function transformExportNamed(body: ESLintExportNamedDeclaration) {
        const [start, end] = getNodeFullRange(body)
        // Consume code up to the start position.
        appendRangeAsStatement(statementCodeBlocks, usedOffset, start)

        const tokens = ast.tokens!
        const exportTokenIndex = tokens.findIndex(
            (t) => t.range[0] === body.range[0],
        )
        const exportToken = tokens[exportTokenIndex]
        if (exportToken?.value === "export") {
            // Consume code up to the start position of `export`.
            // The code may contain legacy decorators.
            append(statementCodeBlocks, usedOffset, exportToken.range[0])
            if (body.declaration) {
                // Append declaration section (Skip `export` token)
                appendRangeAsStatement(
                    statementCodeBlocks,
                    exportToken.range[1],
                    end,
                )

                restoreASTCallbacks.addCallback(
                    scriptSetupStartOffset,
                    [start, end],
                    (statement) => {
                        if (statement.type !== body.declaration!.type) {
                            return null
                        }
                        fixNodeLocations(
                            body,
                            visitorKeys,
                            offsetLocationCalculator,
                        )
                        fixLocation(exportToken, offsetLocationCalculator)
                        body.declaration = statement
                        statement.parent = body
                        return {
                            statement: body,
                            tokens: [exportToken],
                        }
                    },
                )
            } else {
                // Append the code that converted specifiers to destructuring.
                statementCodeBlocks.appendSplitPunctuators("(")
                const restoreTokens: Token[] = [exportToken]
                let startOffset = exportToken.range[1]
                for (const spec of body.specifiers) {
                    if (spec.local.range[0] < spec.exported.range[0]) {
                        // {a as b}
                        const localTokenIndex = tokens.findIndex(
                            (t) => t.range[0] === spec.local.range[0],
                            exportTokenIndex,
                        )
                        checkToken(
                            tokens[localTokenIndex],
                            (spec.local as ESLintIdentifier).name,
                        )
                        const asToken = tokens[localTokenIndex + 1]
                        checkToken(asToken, "as")
                        restoreTokens.push(asToken)
                        const exportedToken = tokens[localTokenIndex + 2]
                        checkToken(
                            exportedToken,
                            spec.exported.type === "Identifier"
                                ? spec.exported.name
                                : spec.exported.raw,
                        )
                        restoreTokens.push(exportedToken)
                        // Skip `as` token
                        append(
                            statementCodeBlocks,
                            startOffset,
                            asToken.range[0],
                        )
                        append(
                            statementCodeBlocks,
                            asToken.range[1],
                            exportedToken.range[0],
                        )
                        startOffset = exportedToken.range[1]
                    }
                }
                append(statementCodeBlocks, startOffset, end)
                statementCodeBlocks.appendSplitPunctuators(")")
                statementCodeBlocks.appendSplitPunctuators(";")

                restoreASTCallbacks.addCallback(
                    scriptSetupStartOffset,
                    [start, end],
                    (statement) => {
                        if (
                            statement.type !== "ExpressionStatement" ||
                            statement.expression.type !== "ObjectExpression"
                        ) {
                            return null
                        }
                        // preprocess and check
                        const locals: ESLintIdentifier[] = []
                        for (const prop of statement.expression.properties) {
                            if (
                                prop.type !== "Property" ||
                                prop.value.type !== "Identifier"
                            ) {
                                return null
                            }
                            locals.push(prop.value)
                        }
                        if (body.specifiers.length !== locals.length) {
                            return null
                        }
                        const map = new Map<
                            ESLintExportSpecifier,
                            ESLintIdentifier
                        >()
                        for (
                            let index = 0;
                            index < body.specifiers.length;
                            index++
                        ) {
                            const spec = body.specifiers[index]
                            const local = locals[index]
                            map.set(spec, local)
                        }

                        // restore
                        fixNodeLocations(
                            body,
                            visitorKeys,
                            offsetLocationCalculator,
                        )
                        for (const token of restoreTokens) {
                            fixLocation(token, offsetLocationCalculator)
                        }
                        for (const [spec, local] of map) {
                            spec.local = local
                            local.parent = spec
                        }
                        return {
                            statement: body,
                            tokens: restoreTokens,
                        }
                    },
                )
            }
        } else {
            // Unknown format
            appendRangeAsStatement(statementCodeBlocks, usedOffset, end)
        }
    }

    for (const body of ast.body) {
        if (
            body.type === "ImportDeclaration" ||
            body.type === "ExportAllDeclaration" ||
            (body.type === "ExportNamedDeclaration" && body.source != null)
        ) {
            const [start, end] = getNodeFullRange(body)
            // Consume code up to the start position.
            appendRangeAsStatement(statementCodeBlocks, usedOffset, start)
            // Append declaration
            appendRangeAsStatement(importCodeBlocks, start, end)
        } else if (body.type === "ExportDefaultDeclaration") {
            const [start, end] = getNodeFullRange(body)
            // Consume code up to the start position.
            appendRangeAsStatement(statementCodeBlocks, usedOffset, start)
            // Append declaration
            appendRangeAsStatement(exportDefaultCodeBlocks, start, end)
        } else if (body.type === "ExportNamedDeclaration") {
            // Transform ExportNamedDeclaration
            // The transformed statement ASTs are restored by RestoreASTCallbacks.
            // e.g.
            // - `export let v = 42` -> `let v = 42`
            // - `export {foo, bar as Bar}` -> `({foo, bar})`
            transformExportNamed(body)
        }
    }
    // Consume the remaining code.
    appendRangeAsStatement(
        statementCodeBlocks,
        usedOffset,
        scriptSetupEndOffset,
    )

    // Creates a code block that combines import, statement block, and export default.
    const codeBlocks = new CodeBlocks()

    let postprocess: Postprocess = () => {
        // noop
    }

    codeBlocks.appendCodeBlocks(importCodeBlocks)
    const scriptSetupBlockRangeStart = codeBlocks.length
    codeBlocks.appendSplitPunctuators("{")
    const generic = extractGeneric(node)
    if (generic) {
        const defineGenericTypeRangeStart = codeBlocks.length
        for (const defineType of generic.defineTypes) {
            codeBlocks.append(defineType.define, defineType.node.range[0])
            codeBlocks.appendSplitPunctuators(";")
        }
        const defineGenericTypeRangeEnd = codeBlocks.length
        postprocess = (eslintResult, context) => {
            const diffOffset =
                context.scriptSetupBlockRange[0] - scriptSetupBlockRangeStart
            const defineGenericTypeRange = [
                defineGenericTypeRangeStart + diffOffset,
                defineGenericTypeRangeEnd + diffOffset,
            ] as const

            function isTypeBlock(
                block: ESLintNode,
            ): block is ESLintBlockStatement {
                return (
                    block.type === "BlockStatement" &&
                    context.scriptSetupBlockRange[0] <= block.range[0] &&
                    block.range[1] <= context.scriptSetupBlockRange[1]
                )
            }

            generic.postprocess({
                result: eslintResult,
                getTypeBlock: (program) => program.body.find(isTypeBlock)!,
                isRemoveTarget(nodeOrToken) {
                    return (
                        defineGenericTypeRange[0] <= nodeOrToken.range[0] &&
                        nodeOrToken.range[1] <= defineGenericTypeRange[1]
                    )
                },
                getTypeDefScope(scopeManager) {
                    const moduleScope =
                        scopeManager.globalScope.childScopes.find(
                            (s) => s.type === "module",
                        ) ?? scopeManager.globalScope
                    return moduleScope.childScopes.find((scope) =>
                        isTypeBlock(scope.block as ESLintNode),
                    )!
                },
            })
        }
    }
    codeBlocks.appendCodeBlocks(statementCodeBlocks)
    codeBlocks.appendSplitPunctuators("}")
    const scriptSetupBlockRangeEnd = codeBlocks.length
    codeBlocks.appendCodeBlocks(exportDefaultCodeBlocks)
    return {
        codeBlocks,
        scriptSetupBlockRange: [
            scriptSetupBlockRangeStart,
            scriptSetupBlockRangeEnd,
        ],
        postprocess,
        restoreASTCallbacks,
    }

    function getNodeFullRange(n: ESLintNode) {
        let start = n.range[0]
        let end = n.range[1]
        traverseNodes(n, {
            visitorKeys,
            enterNode(c) {
                start = Math.min(start, c.range[0])
                end = Math.max(end, c.range[1])
            },
            leaveNode() {
                // Do nothing.
            },
        })
        return [start, end] as const
    }

    function checkToken(token: Token, value: string) {
        if (token.value === value) {
            return
        }

        const perr = new ParseError(
            `Could not parse <script setup>. Expected "${value}", but it was "${token.value}".`,
            undefined,
            token.range[0],
            token.loc.start.line,
            token.loc.start.column,
        )
        fixErrorLocation(perr, offsetLocationCalculator)
        throw perr
    }
}

function remapAST(
    result: ESLintExtendedProgram,
    { scriptSetupBlockRange, codeBlocks }: ScriptSetupModuleCodeBlocks,
): ESLintStatement[] {
    if (!scriptSetupBlockRange) {
        return []
    }

    let scriptSetupBlock: ESLintBlockStatement | null = null
    const scriptSetupStatements: ESLintStatement[] = []
    for (let index = result.ast.body.length - 1; index >= 0; index--) {
        const body = result.ast.body[index]

        if (body.type === "BlockStatement") {
            if (
                scriptSetupBlockRange[0] <= body.range[0] &&
                body.range[1] <= scriptSetupBlockRange[1]
            ) {
                if (scriptSetupBlock) {
                    throw new Error(
                        `Unexpected state error: An unexpected block statement was found. ${JSON.stringify(
                            body.loc,
                        )}`,
                    )
                }
                scriptSetupBlock = body
                scriptSetupStatements.push(
                    ...body.body.filter(
                        (b) => !isSplitPunctuatorsEmptyStatement(b),
                    ),
                )
                result.ast.body.splice(index, 1, ...scriptSetupStatements)
            }
        } else if (body.type === "EmptyStatement") {
            if (isSplitPunctuatorsEmptyStatement(body)) {
                // remove
                result.ast.body.splice(index, 1)
            }
        }
    }

    if (result.scopeManager && scriptSetupBlock) {
        const blockScope = result.scopeManager.acquire(
            scriptSetupBlock as never,
            true,
        )!
        remapScope(result.scopeManager, blockScope)
    }

    return scriptSetupStatements

    function isSplitPunctuatorsEmptyStatement(body: ESLintStatement) {
        return (
            body.type === "EmptyStatement" &&
            codeBlocks.splitPunctuators.includes(body.range[1] - 1)
        )
    }

    function remapScope(scopeManager: ScopeManager, blockScope: Scope) {
        const moduleScope = blockScope.upper!

        // Restore references
        for (const reference of blockScope.references) {
            reference.from = moduleScope
            moduleScope.references.push(reference)
        }
        // Restore variables
        for (const variable of blockScope.variables) {
            variable.scope = moduleScope
            const alreadyVariable = moduleScope.variables.find(
                (v) => v.name === variable.name,
            )
            if (alreadyVariable) {
                alreadyVariable.defs.push(...variable.defs)
                alreadyVariable.identifiers.push(...variable.identifiers)
                alreadyVariable.references.push(...variable.references)
                for (const reference of variable.references) {
                    reference.resolved = alreadyVariable
                }
            } else {
                moduleScope.variables.push(variable)
                moduleScope.set.set(variable.name, variable)
            }
        }
        // Remove scope
        const upper = blockScope.upper
        if (upper) {
            const index = upper.childScopes.indexOf(blockScope)
            if (index >= 0) {
                upper.childScopes.splice(index, 1)
            }
        }
        const index = scopeManager.scopes.indexOf(blockScope)
        if (index >= 0) {
            scopeManager.scopes.splice(index, 1)
        }
    }
}

function remapLocationAndTokens(
    result: ESLintExtendedProgram,
    { codeBlocks }: ScriptSetupModuleCodeBlocks,
    locationCalculator: LocationCalculator,
) {
    const tokens = result.ast.tokens ?? []

    const endMap = new Map<number, number>()
    const buffer: number[] = []
    for (let index = tokens.length - 1; index >= 0; index--) {
        const token = tokens[index]

        if (
            token.range[0] + 1 === token.range[1] &&
            codeBlocks.splitPunctuators.includes(token.range[0])
        ) {
            // remove
            tokens.splice(index, 1)
            buffer.push(token.range[1])
            continue
        } else {
            for (const end of buffer) {
                endMap.set(end, token.range[1])
            }
            buffer.length = 0
        }
    }

    traverseNodes(result.ast, {
        visitorKeys: result.visitorKeys,
        enterNode(node) {
            const rangeEnd = endMap.get(node.range[1])
            if (rangeEnd != null) {
                node.range[1] = rangeEnd
            }
            if (node.end) {
                const end = endMap.get(node.end)
                if (end != null) {
                    node.end = rangeEnd
                }
            }
        },
        leaveNode() {
            // Do nothing.
        },
    })

    fixLocations(result, locationCalculator)
}
