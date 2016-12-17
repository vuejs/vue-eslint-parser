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

describe("About fixtures/notvue.js", () => {
    beforeEach(() => {
        fs.copySync(ORIGINAL_FIXTURE_DIR, FIXTURE_DIR)
    })
    afterEach(() => {
        fs.removeSync(FIXTURE_DIR)
    })

    it("should notify a 'semi' error", () => {
        const cli = new CLIEngine({
            cwd: FIXTURE_DIR,
            envs: ["es6", "node"],
            parser: PARSER_PATH,
            rules: {semi: "error"},
            useEslintrc: false,
        })
        const report = cli.executeOnFiles(["notvue.js"])
        const messages = report.results[0].messages

        assert(messages.length === 1)
        assert(messages[0].ruleId === "semi")
        assert(messages[0].line === 1)
        assert(messages[0].column === 21)
        assert(messages[0].source === "console.log(\"hello\")")
    })

    it("should fix a 'semi' error with --fix option", () => {
        const cli = new CLIEngine({
            cwd: FIXTURE_DIR,
            envs: ["es6", "node"],
            fix: true,
            parser: PARSER_PATH,
            rules: {semi: "error"},
            useEslintrc: false,
        })
        CLIEngine.outputFixes(cli.executeOnFiles(["notvue.js"]))

        const actual = fs.readFileSync(path.join(FIXTURE_DIR, "notvue.js"), "utf8")
        const expected = fs.readFileSync(path.join(FIXTURE_DIR, "notvue.js.fixed"), "utf8")

        assert(actual === expected)
    })
})

describe("About fixtures/lines-around-directive.vue", () => {
    beforeEach(() => {
        fs.copySync(ORIGINAL_FIXTURE_DIR, FIXTURE_DIR)
    })
    afterEach(() => {
        fs.removeSync(FIXTURE_DIR)
    })

    it("should notify no 'lines-around-directive' error (never)", () => {
        const cli = new CLIEngine({
            cwd: FIXTURE_DIR,
            envs: ["es6", "node"],
            parser: PARSER_PATH,
            rules: {"lines-around-directive": ["error", "never"]},
            useEslintrc: false,
        })
        const report = cli.executeOnFiles(["lines-around-directive.vue"])
        const messages = report.results[0].messages

        assert(messages.length === 0)
    })

    it("should notify a 'lines-around-directive' error (always)", () => {
        const cli = new CLIEngine({
            cwd: FIXTURE_DIR,
            envs: ["es6", "node"],
            parser: PARSER_PATH,
            rules: {"lines-around-directive": ["error", "always"]},
            useEslintrc: false,
        })
        const report = cli.executeOnFiles(["lines-around-directive.vue"])
        const messages = report.results[0].messages

        assert(messages.length === 1)
        assert(messages[0].ruleId === "lines-around-directive")
        assert(messages[0].line === 6)
        assert(messages[0].column === 1)
        assert(messages[0].source === "\"use strict\"")
    })

    it("should fix 'lines-around-directive' errors with --fix option", () => {
        const cli = new CLIEngine({
            cwd: FIXTURE_DIR,
            envs: ["es6", "node"],
            fix: true,
            parser: PARSER_PATH,
            rules: {"lines-around-directive": ["error", "always"]},
            useEslintrc: false,
        })
        CLIEngine.outputFixes(cli.executeOnFiles(["lines-around-directive.vue"]))

        const actual = fs.readFileSync(path.join(FIXTURE_DIR, "lines-around-directive.vue"), "utf8")
        const expected = fs.readFileSync(path.join(FIXTURE_DIR, "lines-around-directive-always.vue.fixed"), "utf8")

        assert(actual === expected)
    })
})

describe("About fixtures/crlf.vue", () => {
    beforeEach(() => {
        fs.copySync(ORIGINAL_FIXTURE_DIR, FIXTURE_DIR)
    })
    afterEach(() => {
        fs.removeSync(FIXTURE_DIR)
    })

    it("should notify no 'indent' error", () => {
        const cli = new CLIEngine({
            cwd: FIXTURE_DIR,
            envs: ["es6", "node"],
            parser: PARSER_PATH,
            rules: {indent: "error"},
            useEslintrc: false,
        })
        const report = cli.executeOnFiles(["crlf.vue"])
        const messages = report.results[0].messages

        assert(messages.length === 0)
    })
})

describe("About fixtures/typed.vue", () => {
    beforeEach(() => {
        fs.copySync(ORIGINAL_FIXTURE_DIR, FIXTURE_DIR)
    })
    afterEach(() => {
        fs.removeSync(FIXTURE_DIR)
    })

    it("should notify no error with 'babel-eslint'", () => {
        const cli = new CLIEngine({
            cwd: FIXTURE_DIR,
            envs: ["es6", "node"],
            parser: PARSER_PATH,
            parserOptions: {
                parser: "babel-eslint",
                sourceType: "module",
            },
            rules: {semi: ["error", "never"]},
            useEslintrc: false,
        })
        const report = cli.executeOnFiles(["typed.vue"])
        const messages = report.results[0].messages

        assert(messages.length === 0)
    })

    it("should notify no error with 'typescript-eslint-parser'", () => {
        const cli = new CLIEngine({
            cwd: FIXTURE_DIR,
            envs: ["es6", "node"],
            parser: PARSER_PATH,
            parserOptions: {
                parser: "typescript-eslint-parser",
                sourceType: "module",
            },
            rules: {semi: ["error", "never"]},
            useEslintrc: false,
        })
        const report = cli.executeOnFiles(["typed.vue"])
        const messages = report.results[0].messages

        assert(messages.length === 0)
    })

    it("should fix 'semi' errors with --fix option with 'babel-eslint'", () => {
        const cli = new CLIEngine({
            cwd: FIXTURE_DIR,
            envs: ["es6", "node"],
            fix: true,
            parser: PARSER_PATH,
            parserOptions: {
                parser: "babel-eslint",
                sourceType: "module",
            },
            rules: {semi: ["error", "always"]},
            useEslintrc: false,
        })
        CLIEngine.outputFixes(cli.executeOnFiles(["typed.vue"]))

        const actual = fs.readFileSync(path.join(FIXTURE_DIR, "typed.vue"), "utf8")
        const expected = fs.readFileSync(path.join(FIXTURE_DIR, "typed.vue.fixed"), "utf8")

        assert(actual === expected)
    })

    it("should fix 'semi' errors with --fix option with 'typescript-eslint-parser'", () => {
        const cli = new CLIEngine({
            cwd: FIXTURE_DIR,
            envs: ["es6", "node"],
            fix: true,
            parser: PARSER_PATH,
            parserOptions: { //
                parser: "typescript-eslint-parser",
            },
            rules: {semi: ["error", "always"]},
            useEslintrc: false,
        })
        CLIEngine.outputFixes(cli.executeOnFiles(["typed.vue"]))

        const actual = fs.readFileSync(path.join(FIXTURE_DIR, "typed.vue"), "utf8")
        const expected = fs.readFileSync(path.join(FIXTURE_DIR, "typed.vue.fixed"), "utf8")

        assert(actual === expected)
    })
})
