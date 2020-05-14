import Module from "module"
import path from "path"
import { ESLintExtendedProgram, ESLintProgram } from "../ast"

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

const createRequire: (filename: string) => (filename: string) => any =
    // Added in v12.2.0
    (Module as any).createRequire ||
    // Added in v10.12.0, but deprecated in v12.2.0.
    Module.createRequireFromPath ||
    // Polyfill - This is not executed on the tests on node@>=10.
    /* istanbul ignore next */
    (filename => {
        const mod = new Module(filename)

        mod.filename = filename
        mod.paths = (Module as any)._nodeModulePaths(path.dirname(filename))
        ;(mod as any)._compile("module.exports = require;", filename)
        return mod.exports
    })

let espreeCache: ESLintCustomParser | null = null

function isLinterPath(p: string): boolean {
    return (
        // ESLint 6 and above
        p.includes(
            `eslint${path.sep}lib${path.sep}linter${path.sep}linter.js`,
        ) ||
        // ESLint 5
        p.includes(`eslint${path.sep}lib${path.sep}linter.js`)
    )
}

/**
 * Load `espree` from the loaded ESLint.
 * If the loaded ESLint was not found, just returns `require("espree")`.
 */
export function getEspree(): ESLintCustomParser {
    if (!espreeCache) {
        // Lookup the loaded eslint
        const linterPath = Object.keys(require.cache).find(isLinterPath)
        if (linterPath) {
            try {
                espreeCache = createRequire(linterPath)("espree")
            } catch {
                // ignore
            }
        }
        if (!espreeCache) {
            //eslint-disable-next-line @mysticatea/ts/no-require-imports
            espreeCache = require("espree")
        }
    }

    return espreeCache!
}
