import type { ESLintExtendedProgram, ESLintProgram } from "../ast"
import type { ParserOptions } from "../common/parser-options"
import { getLinterRequire } from "./linter-require"
// @ts-expect-error -- ignore
import * as espree from "espree"
import { lte, lt } from "semver"

/**
 * The interface of a result of ESLint custom parser.
 */
export type ESLintCustomParserResult = ESLintProgram | ESLintExtendedProgram

/**
 * The interface of ESLint custom parsers.
 */
export interface ESLintCustomParser {
    parse(code: string, options: any): ESLintCustomParserResult
    parseForESLint?(code: string, options: any): ESLintCustomParserResult
}
type OldEspree = ESLintCustomParser & {
    latestEcmaVersion?: number
    version: string
}
type Espree = ESLintCustomParser & {
    latestEcmaVersion: number
    version: string
}
let espreeCache: OldEspree | Espree | null = null

/**
 * Gets the espree that the given ecmaVersion can parse.
 */
export function getEspreeFromEcmaVersion(
    ecmaVersion: ParserOptions["ecmaVersion"],
): OldEspree | Espree {
    const linterEspree = getEspreeFromLinter()
    if (
        linterEspree.version != null &&
        lte(espree.version, linterEspree.version)
    ) {
        // linterEspree is newest
        return linterEspree
    }
    if (ecmaVersion == null) {
        return linterEspree
    }
    if (ecmaVersion === "latest") {
        return espree
    }
    if (normalizeEcmaVersion(ecmaVersion) <= getLinterLatestEcmaVersion()) {
        return linterEspree
    }
    return espree

    function getLinterLatestEcmaVersion() {
        if (linterEspree.latestEcmaVersion == null) {
            for (const { v, latest } of [
                { v: "6.1.0", latest: 2020 },
                { v: "4.0.0", latest: 2019 },
            ]) {
                if (lte(v, linterEspree.version)) {
                    return latest
                }
            }
            return 2018
        }
        return normalizeEcmaVersion(linterEspree.latestEcmaVersion)
    }
}

/**
 * Load `espree` from the loaded ESLint.
 * If the loaded ESLint was not found, just returns `require("espree")`.
 */
export function getEspreeFromLinter(): Espree | OldEspree {
    if (!espreeCache) {
        espreeCache = getLinterRequire()?.("espree")
        if (!espreeCache) {
            espreeCache = espree
        }
    }

    return espreeCache!
}

/**
 * Load the newest `espree` from the loaded ESLint or dependency.
 */
function getNewestEspree(): Espree {
    const linterEspree = getEspreeFromLinter()
    if (
        linterEspree.version == null ||
        lte(linterEspree.version, espree.version)
    ) {
        return espree
    }
    return linterEspree as Espree
}

export function getEcmaVersionIfUseEspree(
    parserOptions: ParserOptions,
    getDefault?: (defaultVer: number) => number,
): number | undefined {
    if (parserOptions.parser != null && parserOptions.parser !== "espree") {
        return undefined
    }

    if (parserOptions.ecmaVersion === "latest") {
        return normalizeEcmaVersion(getNewestEspree().latestEcmaVersion)
    }
    if (parserOptions.ecmaVersion == null) {
        const defVer = getDefaultEcmaVersion()
        return getDefault?.(defVer) ?? defVer
    }
    return normalizeEcmaVersion(parserOptions.ecmaVersion)
}

function getDefaultEcmaVersion(): number {
    if (lt(getEspreeFromLinter().version, "9.0.0")) {
        return 5
    }
    // Perhaps the version 9 will change the default to "latest".
    return normalizeEcmaVersion(getNewestEspree().latestEcmaVersion)
}

/**
 * Normalize ECMAScript version
 */
function normalizeEcmaVersion(version: number) {
    if (version > 5 && version < 2015) {
        return version + 2009
    }
    return version
}
