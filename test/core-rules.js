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
const RuleTester = require("./fixtures/eslint/lib/testers/rule-tester")

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const RULES_ROOT = path.join(__dirname, "fixtures/eslint/tests/lib/rules")
const PARSER_PATH = path.resolve(__dirname, "../index.js")
const originalRun = RuleTester.prototype.run

/**
 * Wrap the given code with a `<script>` tag.
 *
 * @param {string} code - The code to be wrapped.
 * @returns {string} The wrapped code.
 */
function wrapCode(code) {
    const eol = code.indexOf("\r\n") !== -1 ? "\r\n" : "\n"
    return `<script>${eol}${code}${eol}</script>`
}

/**
 * Modify the given test pattern to test with vue-eslint-parser.
 *
 * @param {string|object} pattern - The test pattern to be modified.
 * @returns {object|null} The modified pattern.
 */
function modifyPattern(pattern) {
    if (typeof pattern === "string") {
        return {
            code: wrapCode(pattern),
            filename: "test.vue",
            parser: PARSER_PATH,
        }
    }
    if (pattern.parser != null || pattern.filename != null) {
        return null
    }

    pattern.filename = "test.vue"
    pattern.parser = PARSER_PATH
    pattern.code = wrapCode(pattern.code)
    if (pattern.output != null) {
        pattern.output = wrapCode(pattern.output)
    }
    if (Array.isArray(pattern.errors)) {
        for (const error of pattern.errors) {
            if (typeof error === "object") {
                if (error.line != null) {
                    error.line += 1
                }
                if (error.endLine != null) {
                    error.endLine += 1
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
        valid: patterns.valid.map(modifyPattern).filter(Boolean),
        invalid: patterns.invalid.map(modifyPattern).filter(Boolean),
    })
}

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

RuleTester.prototype.run = overrideRun
try {
    describe("Tests of ESLint core rules", () => {
        for (const fileName of fs.readdirSync(RULES_ROOT)) {
            require(path.join(RULES_ROOT, fileName))
        }
    })
}
finally {
    RuleTester.prototype.run = originalRun
}
