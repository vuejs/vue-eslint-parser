import type { ParserOptions } from "../common/parser-options"
import { getLinterRequire } from "./linter-require"
// @ts-expect-error -- ignore
import * as dependencyEspree from "espree"
import { lte, satisfies } from "semver"
import { createRequire } from "./create-require"
import path from "path"
import type { BasicParserObject } from "./parser-object"

type Espree = BasicParserObject & {
    latestEcmaVersion?: number
    version: string
}

/**
 * Load `espree` from the user dir.
 */
function getEspreeFromUser(): Espree {
    try {
        const cwd = process.cwd()
        const relativeTo = path.join(cwd, "__placeholder__.js")
        const require = createRequire(relativeTo)
        const espree = getEspreeFromRequireFunction(require)
        if (espree) {
            if (espree !== dependencyEspree) {
                return espree
            }
            // If the user's espree is the same as the parser package's dependency espree,
            // it checks whether the user has explicitly installed it.
            if (isExplicitlyInstalledEspree(require as NodeRequire)) {
                return espree
            }
        }
    } catch {
        // ignore
    }
    return getEspreeFromLinter()

    function isExplicitlyInstalledEspree(require: NodeRequire): boolean {
        try {
            const espreeRootPath = path.dirname(
                require.resolve("espree/package.json"),
            )
            const nodeModulesPath = path.dirname(espreeRootPath)
            const packageRootPath = path.dirname(nodeModulesPath)
            let pkg
            try {
                pkg = require(path.join(packageRootPath, "package.json"))
            } catch {
                // ignore
            }
            if (pkg) {
                return Boolean(
                    pkg.dependencies?.espree || pkg.devDependencies?.espree,
                )
            }
        } catch {
            // ignore
        }
        // If no package.json is found,
        // it is assumed to have been explicitly installed by the user.
        return true
    }
}

/**
 * Load `espree` from the loaded ESLint.
 * If the loaded ESLint was not found, just returns `require("espree")`.
 */
function getEspreeFromLinter(): Espree {
    try {
        const require = getLinterRequire()
        if (require) {
            const espree = getEspreeFromRequireFunction(require)
            if (espree) {
                return espree
            }
        }
    } catch {
        // ignore
    }
    return dependencyEspree
}

/**
 * Load `espree` from the given require function.
 */
function getEspreeFromRequireFunction(
    require: (name: string) => any,
): Espree | null {
    try {
        const pkg = require("espree/package.json")
        const supportNodeVersion = pkg.engines?.node
        if (
            // If the node version is not supported then espree will not use it.
            !supportNodeVersion ||
            satisfies(process.version, supportNodeVersion)
        ) {
            return require("espree")
        }
    } catch {
        // ignore
    }
    return null
}

/**
 * Load the newest `espree` from the loaded ESLint or dependency.
 */
export function getNewestEspree(): Espree {
    let newest = getEspreeFromLinter()
    const userEspree = getEspreeFromUser()
    if (userEspree.version != null && lte(newest.version, userEspree.version)) {
        newest = userEspree
    }
    return newest
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
        return normalizeEcmaVersion(getLatestEcmaVersion(getNewestEspree()))
    }
    return normalizeEcmaVersion(parserOptions.ecmaVersion)
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
    if (espree.latestEcmaVersion == null) {
        for (const { v, latest } of [
            { v: "6.1.0", latest: 2020 },
            { v: "4.0.0", latest: 2019 },
        ]) {
            if (lte(v, espree.version)) {
                return latest
            }
        }
        return 2018
    }
    return normalizeEcmaVersion(espree.latestEcmaVersion)
}
