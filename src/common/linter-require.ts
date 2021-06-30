import Module from "module"
import path from "path"

const createRequire: (filename: string) => (modname: string) => any =
    // Added in v12.2.0
    (Module as any).createRequire ||
    // Added in v10.12.0, but deprecated in v12.2.0.
    // eslint-disable-next-line @mysticatea/node/no-deprecated-api
    Module.createRequireFromPath ||
    // Polyfill - This is not executed on the tests on node@>=10.
    /* istanbul ignore next */
    ((modname) => {
        const mod = new Module(modname)

        mod.filename = modname
        mod.paths = (Module as any)._nodeModulePaths(path.dirname(modname))
        ;(mod as any)._compile("module.exports = require;", modname)
        return mod.exports
    })

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

export function getLinterRequire() {
    // Lookup the loaded eslint
    const linterPath = Object.keys(require.cache).find(isLinterPath)
    if (linterPath) {
        try {
            return createRequire(linterPath)
        } catch {
            // ignore
        }
    }
    return null
}
