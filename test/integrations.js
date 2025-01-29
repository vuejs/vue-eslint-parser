//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const assert = require("assert")
const path = require("path")
const fs = require("fs-extra")
const cp = require("child_process")
const eslintCompat = require("./lib/eslint-compat")

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const FIXTURE_DIR = path.join(__dirname, "fixtures/integrations")

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("Integration tests", () => {
    for (const target of fs.readdirSync(FIXTURE_DIR)) {
        it(target, async () => {
            let ESLint = eslintCompat(require("eslint")).ESLint
            if (fs.existsSync(path.join(FIXTURE_DIR, target, "package.json"))) {
                const originalCwd = process.cwd()
                try {
                    process.chdir(path.join(FIXTURE_DIR, target))
                    cp.execSync("npm i", { stdio: "inherit" })
                    ESLint = eslintCompat(
                        require(
                            path.join(
                                FIXTURE_DIR,
                                target,
                                "node_modules/eslint",
                            ),
                        ),
                    ).ESLint
                } finally {
                    process.chdir(originalCwd)
                }
            }
            const cwd = path.join(FIXTURE_DIR, target)
            const cli = new ESLint({
                cwd,
            })
            const report = await cli.lintFiles(["**/*.vue"])

            const outputPath = path.join(FIXTURE_DIR, target, `output.json`)
            const expected = JSON.parse(fs.readFileSync(outputPath, "utf8"))
            try {
                assert.deepStrictEqual(
                    normalizeReport(report, { withoutMessage: true }),
                    normalizeReport(expected, {
                        withoutMessage: true,
                    }),
                )
            } catch (e) {
                const actualPath = path.join(
                    FIXTURE_DIR,
                    target,
                    `_actual.json`,
                )
                fs.writeFileSync(
                    actualPath,
                    JSON.stringify(normalizeReport(report), null, 4),
                    "utf8",
                )
                throw e
            }

            function normalizeReport(report, option = {}) {
                return report
                    .filter((res) => res.messages.length)
                    .map((res) => {
                        return {
                            filePath: res.filePath
                                .replace(cwd, "")
                                .replace(/\\/gu, "/"),
                            messages: res.messages.map((msg) => {
                                return {
                                    ruleId: msg.ruleId,
                                    line: msg.line,
                                    ...(option.withoutMessage
                                        ? {}
                                        : { message: msg.message }),
                                }
                            }),
                        }
                    })
                    .sort((a, b) =>
                        a.filePath < b.filePath
                            ? -1
                            : a.filePath < b.filePath
                              ? 1
                              : 0,
                    )
            }
        })
    }
})
