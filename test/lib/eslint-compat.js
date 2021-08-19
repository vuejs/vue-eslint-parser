"use strict"

/**
 * @typedef {import('eslint')} eslint
 */

/** @param {eslint} eslint */
module.exports = function compat(eslint) {
    return {
        ESLint: eslint.ESLint || getESLintClassForV6(eslint),
        RuleTester: eslint.RuleTester,
        Linter: eslint.Linter,
    }
}

/** @returns {typeof eslint.ESLint} */
function getESLintClassForV6(eslint) {
    class ESLintForV6 {
        static get version() {
            return eslint.CLIEngine.version
        }

        /** @param {eslint.ESLint.Options} options */
        constructor(options) {
            const {
                overrideConfig: {
                    plugins,
                    globals,
                    rules,
                    env,
                    ...overrideConfig
                } = {
                    plugins: [],
                    globals: {},
                    rules: {},
                },
                overrideConfigFile,
                fix,
                reportUnusedDisableDirectives,
                plugins: pluginsMap,
                ...otherOptions
            } = options || {}
            /** @type {eslint.CLIEngine.Options} */
            const newOptions = {
                fix: Boolean(fix),
                reportUnusedDisableDirectives: reportUnusedDisableDirectives
                    ? reportUnusedDisableDirectives !== "off"
                    : undefined,
                configFile: overrideConfigFile,
                ...otherOptions,

                envs: env,
                globals: globals
                    ? Object.keys(globals).filter((n) => globals[n])
                    : undefined,
                plugins: plugins || [],
                rules: rules
                    ? Object.entries(rules).reduce((o, [ruleId, opt]) => {
                          if (opt) {
                              o[ruleId] = opt
                          }
                          return o
                      }, /** @type {NonNullable<eslint.CLIEngine.Options["rules"]>} */ ({}))
                    : undefined,
                ...overrideConfig,
            }
            this.engine = new eslint.CLIEngine(newOptions)

            for (const [name, plugin] of Object.entries(pluginsMap || {})) {
                this.engine.addPlugin(name, plugin)
            }
        }

        /**
         * @param {Parameters<eslint.ESLint['lintText']>} params
         * @returns {ReturnType<eslint.ESLint['lintText']>}
         */
        // eslint-disable-next-line require-await -- ignore
        async lintText(...params) {
            const result = this.engine.executeOnText(
                params[0],
                params[1].filePath
            )
            return result.results
        }

        /**
         * @param {Parameters<eslint.ESLint['lintFiles']>} params
         * @returns {ReturnType<eslint.ESLint['lintFiles']>}
         */
        // eslint-disable-next-line require-await -- ignore
        async lintFiles(...params) {
            const result = this.engine.executeOnFiles(
                Array.isArray(params[0]) ? params[0] : [params[0]]
            )
            return result.results
        }

        /**
         * @param {Parameters<eslint.ESLint['outputFixes']>} params
         * @returns {ReturnType<eslint.ESLint['outputFixes']>}
         */
        // eslint-disable-next-line require-await -- ignore
        static async outputFixes(...params) {
            return eslint.CLIEngine.outputFixes({
                results: params[0],
            })
        }
    }

    /** @type {typeof eslint.ESLint} */
    const eslintClass = /** @type {any} */ (ESLintForV6)
    return eslintClass
}
