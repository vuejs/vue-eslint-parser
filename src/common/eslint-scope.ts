import * as escope from "eslint-scope"
import { lte } from "semver"
import path from "path"
import { createRequire } from "module"

type ESLintScope = typeof escope & {
    version: string
}
let escopeCache: ESLintScope | null = null

/**
 * Load the newest `eslint-scope` from the loaded ESLint or dependency.
 */
export function getEslintScope(): ESLintScope {
    return escopeCache ?? (escopeCache = getNewest())
}

/**
 * Load the newest `eslint-scope` from the dependency.
 */
function getNewest(): ESLintScope {
    let newest = escope
    for (const candidate of [
        getEslintScopeFromUser(),
        getEslintScopeFromESLint(),
    ]) {
        if (
            candidate.version != null &&
            lte(newest.version, candidate.version)
        ) {
            newest = candidate
        }
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

/**
 * Load `eslint-scope` from the user's ESLint, which may have its own copy.
 */
function getEslintScopeFromESLint(): ESLintScope {
    try {
        const cwd = process.cwd()
        const relativeTo = path.join(cwd, "__placeholder__.js")
        const eslintPath = createRequire(relativeTo).resolve(
            "eslint/package.json",
        )
        return createRequire(eslintPath)("eslint-scope")
    } catch {
        return escope
    }
}
