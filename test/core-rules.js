/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const path = require("path")
const fs = require("fs-extra")
const { RuleTester } = require("./fixtures/eslint")

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const RULE_DEFS_ROOT = path.join(__dirname, "fixtures/eslint/lib/rules")
const RULE_TESTS_ROOT = path.join(__dirname, "fixtures/eslint/tests/lib/rules")
const PARSER_PATH = path.resolve(__dirname, "../src/index.ts")
const EXCEPTIONS = new Set([
    // Those rules check outside `<script>` tag as well.
    // It cannot fix the behavior in vue-eslint-parser side.
    "eol-last",
    "max-len",
    "max-lines",

    // Wrapper includes line-breaks, so it changed the number of errors.
    // It cannot test this rule correctly.
    "linebreak-style",

    // Tests about the head/last of source code failed because "<script>" tokens
    // are added.
    // It cannot test this rule correctly.
    "lines-around-comment",
    "no-multiple-empty-lines",
    "semi-style",

    // The inside of "<script>" tags is not related to Unicode BOM.
    "unicode-bom",
])
const originalRun = RuleTester.prototype.run
const processed = new Set()

/**
 * Check if the code should be skipped or not.
 * The following code should be skipped.
 * - includes shebang
 * - includes syntax error -- some tests in old ESLint contains syntax error.
 *   Acorn has fixed to catch the syntax errors in a minor release, so those
 *   tests go to fail.
 * @param {string} code The test code.
 */
function codeShouldBeSkipped(code) {
    return code.startsWith("#!") || code.includes("await async")
}

/**
 * Wrap the given code with a `<script>` tag.
 *
 * @param {string} ruleId The rule ID.
 * @param {string} code - The code to be wrapped.
 * @returns {string} The wrapped code.
 */
function wrapCode(ruleId, code) {
    const eol = "\n"

    if (code.charCodeAt(0) === 0xfeff) {
        return `\uFEFF<script>${eol}${code.slice(1)}${eol}</script>`
    }
    if (ruleId === "prefer-regex-literals") {
        return `<script>;${eol}${code}${eol}</script>`
    }
    return `<script>${eol}${code}${eol}</script>`
}

/**
 * Modify the given test pattern to test with vue-eslint-parser.
 *
 * @param {string} ruleId The rule ID.
 * @param {string|object} pattern - The test pattern to be modified.
 * @returns {object|null} The modified pattern.
 */
//eslint-disable-next-line complexity
function modifyPattern(ruleId, pattern) {
    if (typeof pattern === "string") {
        if (codeShouldBeSkipped(pattern)) {
            return null
        }
        return {
            code: wrapCode(ruleId, pattern),
            filename: "test.vue",
            parser: PARSER_PATH,
        }
    }

    // If a test case depends on filename or special parser (returns constant AST
    // object), we cannot rewrite the test case with `vue-eslint-parser`.
    if (
        pattern.parser != null ||
        pattern.filename != null ||
        codeShouldBeSkipped(pattern.code)
    ) {
        return null
    }

    // Ignore for now
    if (
        (ruleId === "newline-per-chained-call" &&
            pattern.code === "foo.bar()['foo' + \u2029 + 'bar']()") ||
        (ruleId === "no-nonoctal-decimal-escape" &&
            pattern.code === "'\\\r\n\\9'") ||
        // The location is reported as a fixed value: { line: 1, column: 0 }.
        (ruleId === "consistent-return" &&
            pattern.parserOptions &&
            pattern.parserOptions.ecmaFeatures &&
            pattern.parserOptions.ecmaFeatures.globalReturn === true)
    ) {
        return null
    }

    // Wrap the code by `<script>` tag.
    pattern.filename = "test.vue"
    pattern.parser = PARSER_PATH
    pattern.code = wrapCode(ruleId, pattern.code)
    if (pattern.output != null) {
        pattern.output = wrapCode(ruleId, pattern.output)
    }

    if (Array.isArray(pattern.errors)) {
        for (const error of pattern.errors) {
            if (typeof error === "object" && !processed.has(error)) {
                processed.add(error)

                // The line number +1 because `<script>\n` is inserted.
                if (typeof error.line === "number") {
                    error.line += 1
                }
                if (typeof error.endLine === "number") {
                    error.endLine += 1
                }

                // `semi` rule is special a bit.
                // The `endLine` is explicitly undefined if it inserts semi into EOF.
                // The `endColumn` is explicitly undefined if it inserts semi into EOF.
                // Those becomes non-EOF because `\n</script>` is inserted.
                if (ruleId === "semi") {
                    if (
                        Object.hasOwnProperty.call(error, "endLine") &&
                        error.endLine === undefined
                    ) {
                        const lines = pattern.code.split(/\r\n|[\r\n]/gu)
                        error.endLine = lines.length
                    }
                    if (
                        Object.hasOwnProperty.call(error, "endColumn") &&
                        error.endColumn === undefined
                    ) {
                        error.endColumn = 1
                    }
                }

                // `no-shadow` rule is special a bit.
                if (ruleId === "no-shadow") {
                    // The data that the rule gives to the message contains the location.
                    if (
                        error.data &&
                        error.data &&
                        Object.hasOwnProperty.call(
                            error.data,
                            "shadowedLine",
                        ) &&
                        typeof error.data.shadowedLine === "number"
                    ) {
                        error.data.shadowedLine++
                    }
                }

                // Wrap the code by `<script>` tag.
                if (Array.isArray(error.suggestions)) {
                    for (const suggestion of error.suggestions) {
                        suggestion.output = wrapCode(ruleId, suggestion.output)
                    }
                }
            }
        }
    }

    return pattern
}

/**
 * Run the given tests.
 * This is used to replace `RuleTester.prototype.run`.
 *
 * @this {RuleTester}
 * @param {string} ruleId - The rule ID.
 * @param {object} impl - The rule implementation to be tested.
 * @param {object} patterns - The test patterns.
 * @returns {void}
 */
function overrideRun(ruleId, impl, patterns) {
    return originalRun.call(this, ruleId, impl, {
        valid: patterns.valid
            .map((pattern) => modifyPattern(ruleId, pattern))
            .filter(Boolean),
        invalid: patterns.invalid
            .map((pattern) => modifyPattern(ruleId, pattern))
            .filter(Boolean),
    })
}

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

RuleTester.prototype.run = overrideRun
try {
    describe("Tests of ESLint core rules", () => {
        for (const fileName of fs.readdirSync(RULE_TESTS_ROOT)) {
            if (path.extname(fileName) !== ".js" || fileName.startsWith("_")) {
                continue
            }
            if (require(path.join(RULE_DEFS_ROOT, fileName)).meta.deprecated) {
                continue
            }
            if (EXCEPTIONS.has(path.basename(fileName, ".js"))) {
                continue
            }

            require(path.join(RULE_TESTS_ROOT, fileName))
        }
    })
} finally {
    RuleTester.prototype.run = originalRun
    processed.clear()
}
