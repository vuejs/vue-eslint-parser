import * as escope from "eslint-scope"
import { getLinterRequire } from "./linter-require"
import { lte } from "semver"

let escopeCache: typeof escope | null = null

/**
 * Load the newest `eslint-scope` from the loaded ESLint or dependency.
 */
export function getEslintScope(): typeof escope & {
    version: string
} {
    if (!escopeCache) {
        escopeCache = getLinterRequire()?.("eslint-scope")
        if (
            !escopeCache ||
            escopeCache.version == null ||
            lte(escopeCache.version, escope.version)
        ) {
            escopeCache = escope
        }
    }

    return escopeCache
}
