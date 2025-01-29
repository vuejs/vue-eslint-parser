import type { ESLintExtendedProgram, ESLintProgram } from "../ast/index"

/**
 * The type of basic ESLint custom parser.
 * e.g. espree
 */
export type BasicParserObject<R = ESLintProgram> = {
    parse(code: string, options: any): R
    parseForESLint: undefined
}
/**
 * The type of ESLint custom parser enhanced for ESLint.
 * e.g. @babel/eslint-parser, @typescript-eslint/parser
 */
export type EnhancedParserObject<R = ESLintExtendedProgram> = {
    parseForESLint(code: string, options: any): R
    parse: undefined
}

/**
 * The type of ESLint (custom) parsers.
 */
export type ParserObject<R1 = ESLintExtendedProgram, R2 = ESLintProgram> =
    | EnhancedParserObject<R1>
    | BasicParserObject<R2>

export function isParserObject<R1, R2>(
    value: ParserObject<R1, R2> | {} | undefined | null,
): value is ParserObject<R1, R2> {
    return isEnhancedParserObject(value) || isBasicParserObject(value)
}
export function isEnhancedParserObject<R>(
    value: EnhancedParserObject<R> | {} | undefined | null,
): value is EnhancedParserObject<R> {
    return Boolean(value && typeof (value as any).parseForESLint === "function")
}
export function isBasicParserObject<R>(
    value: BasicParserObject<R> | {} | undefined | null,
): value is BasicParserObject<R> {
    return Boolean(value && typeof (value as any).parse === "function")
}
