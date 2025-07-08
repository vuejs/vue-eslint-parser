import type { ESLint, Linter, RuleTester } from "eslint"

export default function compat(eslint: any): {
    ESLint: typeof ESLint
    RuleTester: typeof RuleTester
    Linter: typeof Linter
} {
    return {
        ESLint: eslint.ESLint || getESLintClassForV6(eslint),
        RuleTester: eslint.RuleTester,
        Linter: eslint.Linter,
    }
}

function getESLintClassForV6(eslint: any): typeof ESLint {
    class ESLintForV6 {
        public engine

        // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
        static get version() {
            return eslint.CLIEngine.version
        }

        // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
        constructor(options: any) {
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
                } as any,
                overrideConfigFile,
                fix,
                reportUnusedDisableDirectives,
                plugins: pluginsMap,
                ...otherOptions
            } = options || {}
            const newOptions = {
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
                          {} as Record<string, any>,
                      )
                    : undefined,
                ...overrideConfig,
            }
            this.engine = new eslint.CLIEngine(newOptions)

            for (const [name, plugin] of Object.entries(pluginsMap || {})) {
                this.engine.addPlugin(name, plugin)
            }
        }

        // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
        async lintText(
            ...params: Parameters<ESLint["lintText"]>
        ): ReturnType<ESLint["lintText"]> {
            const result = await this.engine.executeOnText(
                params[0],
                params[1]!.filePath,
            )
            return result.results
        }

        // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
        async lintFiles(
            ...params: Parameters<ESLint["lintFiles"]>
        ): ReturnType<ESLint["lintFiles"]> {
            const result = await this.engine.executeOnFiles(
                Array.isArray(params[0]) ? params[0] : [params[0]],
            )
            return result.results
        }

        // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
        static async outputFixes(
            ...params: Parameters<typeof ESLint.outputFixes>
        ): ReturnType<typeof ESLint.outputFixes> {
            // eslint-disable-next-line no-return-await
            return await eslint.CLIEngine.outputFixes({
                results: params[0],
            })
        }
    }

    return ESLintForV6 as any
}
