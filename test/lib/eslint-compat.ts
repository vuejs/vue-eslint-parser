import type { ESLint } from "eslint"

export default function compat(eslint: any) {
    return {
        ESLint: eslint.ESLint || getESLintClassForV6(eslint),
        RuleTester: eslint.RuleTester,
        Linter: eslint.Linter,
    }
}

function getESLintClassForV6(eslint: any): ESLint {
    class ESLintForV6 {
        public engine

        static get version() {
            return eslint.CLIEngine.version
        }

        // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
        constructor(options: ESLint.Options) {
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
            const newOptions: CLIEngine.Options = {
                fix: Boolean(fix),
                reportUnusedDisableDirectives: reportUnusedDisableDirectives
                    ? reportUnusedDisableDirectives !== "off"
                    : undefined,
                configFile: overrideConfigFile,
                ...otherOptions,

                envs: Object.entries(env)
                    .filter(([, v]) => v)
                    .map(([k]) => k),
                globals: globals
                    ? Object.keys(globals).filter((n) => globals[n])
                    : undefined,
                plugins: plugins || [],
                rules: rules
                    ? Object.entries(rules).reduce(
                          (o, [ruleId, opt]) => {
                              if (opt) {
                                  o[ruleId] = opt
                              }
                              return o
                          },
                          {} satisfies NonNullable<CLIEngine.Options["rules"]>,
                      )
                    : undefined,
                ...overrideConfig,
            }
            this.engine = new eslint.CLIEngine(newOptions)

            for (const [name, plugin] of Object.entries(pluginsMap || {})) {
                this.engine.addPlugin(name, plugin)
            }
        }

        async lintText(
            ...params: Parameters<ESLint["lintText"]>
        ): ReturnType<ESLint["lintText"]> {
            const result = this.engine.executeOnText(
                params[0],
                params[1]!.filePath,
            )
            return result.results
        }

        async lintFiles(
            ...params: Parameters<ESLint["lintFiles"]>
        ): ReturnType<ESLint["lintFiles"]> {
            const result = this.engine.executeOnFiles(
                Array.isArray(params[0]) ? params[0] : [params[0]],
            )
            return result.results
        }

        static async outputFixes(
            ...params: Parameters<ESLint["outputFixes"]>
        ): ReturnType<ESLint["outputFixes"]> {
            return eslint.CLIEngine.outputFixes({
                results: params[0],
            })
        }
    }

    return ESLintForV6 as any
}
