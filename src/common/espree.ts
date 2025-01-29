import type { ParserOptions } from "../common/parser-options"
// @ts-expect-error -- ignore
import * as dependencyEspree from "espree"
import { lte } from "semver"
import { createRequire } from "./create-require"
import path from "path"
import type { BasicParserObject } from "./parser-object"

type Espree = BasicParserObject & {
    latestEcmaVersion: number
    version: string
}
let espreeCache: Espree | null = null

/**
 * Gets the espree that the given ecmaVersion can parse.
 */
export function getEspree(): Espree {
    return espreeCache || (espreeCache = getNewestEspree())
}

/**
 * Load `espree` from the user dir.
 */
function getEspreeFromUser(): Espree {
    try {
        const cwd = process.cwd()
        const relativeTo = path.join(cwd, "__placeholder__.js")
        return createRequire(relativeTo)("espree")
    } catch {
        return dependencyEspree
    }
}

/**
 * Load the newest `espree` from the dependency.
 */
function getNewestEspree(): Espree {
    let newest = dependencyEspree
    const userEspree = getEspreeFromUser()
    if (userEspree.version != null && lte(newest.version, userEspree.version)) {
        newest = userEspree
    }
    return newest
}

export function getEcmaVersionIfUseEspree(
    parserOptions: ParserOptions,
    getDefault?: (defaultVer: number) => number,
): number | undefined {
    if (parserOptions.parser != null && parserOptions.parser !== "espree") {
        return undefined
    }

    if (parserOptions.ecmaVersion === "latest") {
        return getDefaultEcmaVersion()
    }
    if (parserOptions.ecmaVersion == null) {
        const defVer = getDefaultEcmaVersion()
        return getDefault?.(defVer) ?? defVer
    }
    return normalizeEcmaVersion(parserOptions.ecmaVersion)
}

function getDefaultEcmaVersion(): number {
    return normalizeEcmaVersion(getLatestEcmaVersion(getNewestEspree()))
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

function getLatestEcmaVersion(espree: Espree) {
    return normalizeEcmaVersion(espree.latestEcmaVersion)
}
