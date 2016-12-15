/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const assert = require("assert")
const path = require("path")
const CLIEngine = require("eslint").CLIEngine
const fs = require("fs-extra")

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const ORIGINAL_FIXTURE_DIR = path.join(__dirname, "fixtures")
const FIXTURE_DIR = path.join(__dirname, "temp")
const PARSER_PATH = path.resolve(__dirname, "../index.js")

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("About fixtures/hello.vue", () => {
    beforeEach(() => {
        fs.copySync(ORIGINAL_FIXTURE_DIR, FIXTURE_DIR)
    })
    afterEach(() => {
        fs.removeSync(FIXTURE_DIR)
    })

    it("should notify 2 'semi' errors", () => {
        const cli = new CLIEngine({
            cwd: FIXTURE_DIR,
            envs: ["es6", "node"],
            parser: PARSER_PATH,
            rules: {semi: "error"},
            useEslintrc: false,
        })
        const report = cli.executeOnFiles(["hello.vue"])
        const messages = report.results[0].messages

        assert(messages.length === 2)
        assert(messages[0].ruleId === "semi")
        assert(messages[0].line === 8)
        assert(messages[0].column === 35)
        assert(messages[0].source === "        return {greeting: \"Hello\"}")
        assert(messages[1].ruleId === "semi")
        assert(messages[1].line === 10)
        assert(messages[1].column === 2)
        assert(messages[1].source === "}")
    })

    it("should fix 2 'semi' errors with --fix option", () => {
        const cli = new CLIEngine({
            cwd: FIXTURE_DIR,
            envs: ["es6", "node"],
            fix: true,
            parser: PARSER_PATH,
            rules: {semi: "error"},
            useEslintrc: false,
        })
        CLIEngine.outputFixes(cli.executeOnFiles(["hello.vue"]))

        const actual = fs.readFileSync(path.join(FIXTURE_DIR, "hello.vue"), "utf8")
        const expected = fs.readFileSync(path.join(FIXTURE_DIR, "hello.vue.fixed"), "utf8")

        assert(actual === expected)
    })
})
