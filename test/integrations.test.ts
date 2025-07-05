//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

import { assert, beforeAll, describe, it } from "vitest"
import path from "node:path"
import fs from "node:fs"
import cp from "child_process"
import eslintCompat from "./lib/eslint-compat"
import ESLintRaw from "eslint"

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

// eslint-disable-next-line no-undef
const FIXTURE_DIR = path.join(__dirname, "fixtures/integrations")

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("Integration tests", () => {
    beforeAll(async () => {
        await import("ts-node/register")
    })
    for (const target of fs.readdirSync(FIXTURE_DIR)) {
        it(target, async () => {
            let ESLint = eslintCompat(ESLintRaw).ESLint
            if (fs.existsSync(path.join(FIXTURE_DIR, target, "package.json"))) {
                const originalCwd = process.cwd()
                try {
                    process.chdir(path.join(FIXTURE_DIR, target))
                    cp.execSync("npm i", { stdio: "inherit" })
                    ESLint = eslintCompat(
                        // eslint-disable-next-line @typescript-eslint/no-require-imports
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

            const outputPath = path.join(FIXTURE_DIR, target, "output.json")
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
                    "_actual.json",
                )
                fs.writeFileSync(
                    actualPath,
                    JSON.stringify(normalizeReport(report), null, 4),
                    "utf8",
                )
                throw e
            }

            function normalizeReport(
                result: ESLintRaw.ESLint.LintResult[],
                option: { withoutMessage?: boolean } = {},
            ) {
                return result
                    .filter((res) => res.messages.length)
                    .map((res) => ({
                        filePath: res.filePath
                            .replace(cwd, "")
                            .replace(/\\/gu, "/"),
                        messages: res.messages.map((msg) => ({
                            ruleId: msg.ruleId,
                            line: msg.line,
                            ...(option.withoutMessage
                                ? {}
                                : { message: msg.message }),
                        })),
                    }))
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
