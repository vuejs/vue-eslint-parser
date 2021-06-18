/**
 * @author Yosuke Ota <https://github.com/ota-meshi>
 * See LICENSE file in root directory for full license.
 */
import type { ESLintExtendedProgram, ESLintStatement, VElement } from "../ast"
import { ParseError, traverseNodes } from "../ast"
import { fixErrorLocation, fixLocations } from "../common/fix-locations"
import type { LinesAndColumns } from "../common/lines-and-columns"
import type { LocationFixCalculator } from "../common/location-fix-calculator"
import { simpleOffsetLocationFixCalculator } from "../common/location-fix-calculator"
import type { ParserOptions } from "../common/parser-options"
import { parseScript, parseScriptFragment } from "../script"

type RemapBlock = {
    range: [number, number]
    offset: number
}
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
        this.code += codeLet.trimRight()
        this.remapBlocks.push({
            range: [rangeStart, this.code.length],
            offset: originalOffset - rangeStart,
        })
    }
    public appendSplitPunctuators(punctuator: string) {
        this.splitPunctuators.push(this.code.length)
        this.code += `${punctuator}\n`
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

type ScriptSetupCodeBlocks = {
    codeBlocks: CodeBlocks
    // The location of the code of the import statements in `<script setup>`.
    scriptSetupImportRange?: [number, number]
    // The location of the code of the statements in `<script setup>`.
    scriptSetupBlockRange?: [number, number]
}

/**
 * Parse the source code of the given `<script setup>` and `<script>` elements.
 * @param scriptSetupElement The `<script setup>` element to parse.
 * @param nodes The `<script>` elements to parse.
 * @param code The source code of SFC.
 * @param linesAndColumns The lines and columns location calculator.
 * @param parserOptions The parser options.
 * @returns The result of parsing.
 */
export function parseScriptSetupElements(
    scriptSetupElement: VElement,
    scriptElement: VElement,
    code: string,
    linesAndColumns: LinesAndColumns,
    originalParserOptions: ParserOptions,
): ESLintExtendedProgram {
    const parserOptions: ParserOptions = {
        ...originalParserOptions,
        // enforce module
        sourceType: "module",
        ecmaVersion:
            typeof originalParserOptions.ecmaVersion === "number" &&
            originalParserOptions.ecmaVersion > 5
                ? originalParserOptions.ecmaVersion
                : 2015,
    }
    const scriptSetupCodeBlocks = getScriptsCodeBlocks(
        scriptSetupElement,
        scriptElement,
        code,
        linesAndColumns,
        parserOptions,
    )
    if (!scriptSetupCodeBlocks) {
        return parseScriptFragment(
            "",
            simpleOffsetLocationFixCalculator(
                scriptSetupElement.startTag.range[1],
                linesAndColumns,
            ),
            parserOptions,
        )
    }

    const locationFixCalculator: LocationFixCalculator = {
        getFixOffset(offset, kind) {
            const test: (block: RemapBlock) => boolean =
                kind === "start"
                    ? (block) => offset < block.range[1]
                    : (block) => offset <= block.range[1]

            for (const block of scriptSetupCodeBlocks.codeBlocks.remapBlocks) {
                if (test(block)) {
                    return block.offset
                }
            }
            return offset
        },
        getLocFromIndex: linesAndColumns.getLocFromIndex.bind(linesAndColumns),
    }

    let result
    try {
        result = parseScript(
            scriptSetupCodeBlocks.codeBlocks.code,
            parserOptions,
        )
    } catch (err) {
        const perr = ParseError.normalize(err)
        if (perr) {
            fixErrorLocation(perr, locationFixCalculator)
            throw perr
        }
        throw err
    }

    /* Remap ASTs */
    remapAST(result, scriptSetupCodeBlocks)

    /* Remap locations */
    remapLocationAndTokens(result, scriptSetupCodeBlocks, locationFixCalculator)

    // Adjust AST and tokens
    if (result.ast.tokens != null) {
        for (const node of [scriptSetupElement, scriptElement]) {
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
    result.ast.body.sort((a, b) => a.range[0] - b.range[0])

    const programEndOffset = result.ast.body.reduce(
        (end, node) => Math.max(end, node.range[1]),
        0,
    )
    result.ast.range[1] = programEndOffset
    result.ast.loc.end = locationFixCalculator.getLocFromIndex(programEndOffset)
    if (result.ast.end != null) {
        result.ast.end = [scriptSetupElement, scriptElement].reduce(
            (end, node) => {
                const textNode = node.children[0]
                return Math.max(
                    end,
                    textNode != null && textNode.type === "VText"
                        ? textNode.range[1]
                        : node.endTag?.range[1] ?? node.range[1],
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
 */
function getScriptsCodeBlocks(
    scriptSetupElement: VElement,
    scriptElement: VElement,
    sfcCode: string,
    linesAndColumns: LinesAndColumns,
    parserOptions: ParserOptions,
): ScriptSetupCodeBlocks | null {
    const scriptSetupCodeBlocks = getScriptSetupCodeBlocks(
        scriptSetupElement,
        sfcCode,
        linesAndColumns,
        parserOptions,
    )

    const textNode = scriptElement.children[0]
    if (textNode == null || textNode.type !== "VText") {
        return scriptSetupCodeBlocks
    }

    const [scriptStartOffset, scriptEndOffset] = textNode.range
    const codeBlocks = new CodeBlocks()
    codeBlocks.append(
        sfcCode.slice(scriptStartOffset, scriptEndOffset),
        scriptStartOffset,
    )
    if (scriptSetupCodeBlocks == null) {
        return { codeBlocks }
    }

    codeBlocks.appendSplitPunctuators(";")
    const scriptSetupOffset = codeBlocks.length
    codeBlocks.appendCodeBlocks(scriptSetupCodeBlocks.codeBlocks)
    return {
        codeBlocks,
        scriptSetupImportRange:
            scriptSetupCodeBlocks.scriptSetupImportRange && [
                scriptSetupCodeBlocks.scriptSetupImportRange[0] +
                    scriptSetupOffset,
                scriptSetupCodeBlocks.scriptSetupImportRange[1] +
                    scriptSetupOffset,
            ],
        scriptSetupBlockRange: scriptSetupCodeBlocks.scriptSetupBlockRange && [
            scriptSetupCodeBlocks.scriptSetupBlockRange[0] + scriptSetupOffset,
            scriptSetupCodeBlocks.scriptSetupBlockRange[1] + scriptSetupOffset,
        ],
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

    const [scriptStartOffset, scriptEndOffset] = textNode.range
    const scriptCode = sfcCode.slice(scriptStartOffset, scriptEndOffset)

    let result
    try {
        result = parseScript(scriptCode, parserOptions)
    } catch (err) {
        const perr = ParseError.normalize(err)
        if (perr) {
            fixErrorLocation(
                perr,
                simpleOffsetLocationFixCalculator(
                    scriptStartOffset,
                    linesAndColumns,
                ),
            )
            throw perr
        }
        throw err
    }
    const { ast } = result

    const importCodeBlocks = new CodeBlocks()
    const statementCodeBlocks = new CodeBlocks()

    let astOffset = 0
    for (const body of ast.body) {
        if (body.type === "ImportDeclaration") {
            let start = body.range[0]
            let end = body.range[1]
            traverseNodes(body, {
                visitorKeys: result.visitorKeys,
                enterNode(n) {
                    start = Math.min(start, n.range[0])
                    end = Math.max(end, n.range[1])
                },
                leaveNode() {
                    // Do nothing.
                },
            })
            if (astOffset < start) {
                statementCodeBlocks.append(
                    scriptCode.slice(astOffset, start),
                    scriptStartOffset + astOffset,
                )
                statementCodeBlocks.appendSplitPunctuators(";")
            }

            importCodeBlocks.append(
                scriptCode.slice(start, end),
                scriptStartOffset + start,
            )
            importCodeBlocks.appendSplitPunctuators(";")
            astOffset = end
        }
    }
    if (astOffset < scriptEndOffset) {
        statementCodeBlocks.append(
            scriptCode.slice(astOffset, scriptEndOffset),
            scriptStartOffset + astOffset,
        )
    }

    const scriptSetupImportRange: [number, number] = [
        0,
        importCodeBlocks.length,
    ]
    const scriptSetupBlockRangeStart = importCodeBlocks.length
    importCodeBlocks.appendSplitPunctuators("{")
    importCodeBlocks.appendCodeBlocks(statementCodeBlocks)
    importCodeBlocks.appendSplitPunctuators("}")

    return {
        codeBlocks: importCodeBlocks,
        scriptSetupImportRange,
        scriptSetupBlockRange: [
            scriptSetupBlockRangeStart,
            importCodeBlocks.length,
        ],
    }
}

function remapAST(
    result: ESLintExtendedProgram,
    {
        scriptSetupImportRange,
        scriptSetupBlockRange,
        codeBlocks,
    }: ScriptSetupCodeBlocks,
) {
    if (!scriptSetupImportRange || !scriptSetupBlockRange) {
        return
    }

    for (let index = result.ast.body.length - 1; index >= 0; index--) {
        const body = result.ast.body[index]

        if (body.type === "BlockStatement") {
            if (
                scriptSetupBlockRange[0] <= body.range[0] &&
                body.range[1] <= scriptSetupBlockRange[1]
            ) {
                result.ast.body.splice(
                    index,
                    1,
                    ...body.body.filter(
                        (b) => !isSplitPunctuatorsEmptyStatement(b),
                    ),
                )
            }
        } else if (body.type === "EmptyStatement") {
            if (isSplitPunctuatorsEmptyStatement(body)) {
                // remove
                result.ast.body.splice(index, 1)
            }
        }
    }

    function isSplitPunctuatorsEmptyStatement(body: ESLintStatement) {
        return (
            body.type === "EmptyStatement" &&
            codeBlocks.splitPunctuators.includes(body.range[1] - 1)
        )
    }
}

function remapLocationAndTokens(
    result: ESLintExtendedProgram,
    { codeBlocks }: ScriptSetupCodeBlocks,
    locationFixCalculator: LocationFixCalculator,
) {
    traverseNodes(result.ast, {
        visitorKeys: result.visitorKeys,
        enterNode(node) {
            if (codeBlocks.splitPunctuators.includes(node.range[1] - 1)) {
                node.range[1]--
            }
            if (
                node.end != null &&
                codeBlocks.splitPunctuators.includes(node.end - 1)
            ) {
                node.end--
            }
        },
        leaveNode() {
            // Do nothing.
        },
    })

    const tokens = result.ast.tokens || []
    for (let index = tokens.length - 1; index >= 0; index--) {
        const token = tokens[index]

        if (
            token.range[0] + 1 === token.range[1] &&
            codeBlocks.splitPunctuators.includes(token.range[0])
        ) {
            // remove
            tokens.splice(index, 1)
            continue
        }
    }

    fixLocations(result, locationFixCalculator)
}
