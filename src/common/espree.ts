import type { ParserOptions } from "../common/parser-options"
// @ts-expect-error -- ignore
import * as dependencyEspree from "espree"
import { lte } from "semver"
import path from "path"
import type { BasicParserObject } from "./parser-object"
import { createRequire } from "module"

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

export function getEcmaVersionIfUseEspree(
    parserOptions: ParserOptions,
): number | undefined {
    if (parserOptions.parser != null && parserOptions.parser !== "espree") {
        return undefined
    }

    if (
        parserOptions.ecmaVersion === "latest" ||
        parserOptions.ecmaVersion == null
    ) {
        return getDefaultEcmaVersion()
    }
    return normalizeEcmaVersion(parserOptions.ecmaVersion)
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

function getDefaultEcmaVersion(): number {
    return getLatestEcmaVersion(getEspree())
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
