import * as escope from "eslint-scope"
import { lte } from "semver"
import { createRequire } from "./create-require"
import path from "path"

type ESLintScope = typeof escope & {
    version: string
}
let escopeCache: ESLintScope | null = null

/**
 * Load the newest `eslint-scope` from the loaded ESLint or dependency.
 */
export function getEslintScope(): ESLintScope {
    return escopeCache || (escopeCache = getNewest())
}

/**
 * Load the newest `eslint-scope` from the dependency.
 */
function getNewest(): ESLintScope {
    let newest = escope
    const userEscope = getEslintScopeFromUser()
    if (userEscope.version != null && lte(newest.version, userEscope.version)) {
        newest = userEscope
    }
    return newest
}

/**
 * Load `eslint-scope` from the user dir.
 */
function getEslintScopeFromUser(): ESLintScope {
    try {
        const cwd = process.cwd()
        const relativeTo = path.join(cwd, "__placeholder__.js")
        return createRequire(relativeTo)("eslint-scope")
    } catch {
        return escope
    }
}
