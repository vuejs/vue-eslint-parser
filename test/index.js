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
const fs = require("fs-extra")
const parse = require("..").parse
const parseForESLint = require("..").parseForESLint
const CLIEngine = require("./fixtures/eslint").CLIEngine

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const ORIGINAL_FIXTURE_DIR = path.join(__dirname, "fixtures")
const FIXTURE_DIR = path.join(__dirname, "temp")
const PARSER_PATH = path.resolve(__dirname, "../index.js")

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("Basic tests", () => {
    beforeEach(() => {
        fs.emptyDirSync(FIXTURE_DIR)
        for (const fileName of fs.readdirSync(ORIGINAL_FIXTURE_DIR)) {
            const src = path.join(ORIGINAL_FIXTURE_DIR, fileName)
            const dst = path.join(FIXTURE_DIR, fileName)

            if (fs.statSync(src).isFile()) {
                fs.copySync(src, dst)
            }
        }
    })
    afterEach(() => {
        fs.removeSync(FIXTURE_DIR)
    })

    describe("About fixtures/hello.vue", () => {
        it("should notify 2 'semi' errors", () => {
            const cli = new CLIEngine({
                cwd: FIXTURE_DIR,
                envs: ["es6", "node"],
                parser: PARSER_PATH,
                rules: { semi: "error" },
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
                rules: { semi: "error" },
                useEslintrc: false,
            })
            CLIEngine.outputFixes(cli.executeOnFiles(["hello.vue"]))

            const actual = fs.readFileSync(path.join(FIXTURE_DIR, "hello.vue"), "utf8")
            const expected = fs.readFileSync(path.join(FIXTURE_DIR, "hello.vue.fixed"), "utf8")

            assert(actual === expected)
        })
    })

    describe("About fixtures/empty.vue", () => {
        it("should notify no error", () => {
            const cli = new CLIEngine({
                cwd: FIXTURE_DIR,
                envs: ["es6", "node"],
                parser: PARSER_PATH,
                rules: { semi: "error" },
                useEslintrc: false,
            })
            const report = cli.executeOnFiles(["empty.vue"])
            const messages = report.results[0].messages

            assert(messages.length === 0)
        })
    })

    describe("About fixtures/no-script.vue", () => {
        it("should notify no error", () => {
            const cli = new CLIEngine({
                cwd: FIXTURE_DIR,
                envs: ["es6", "node"],
                parser: PARSER_PATH,
                rules: { semi: "error" },
                useEslintrc: false,
            })
            const report = cli.executeOnFiles(["no-script.vue"])
            const messages = report.results[0].messages

            assert(messages.length === 0)
        })
    })

    describe("About fixtures/empty-script.vue", () => {
        it("should notify no error", () => {
            const cli = new CLIEngine({
                cwd: FIXTURE_DIR,
                envs: ["es6", "node"],
                parser: PARSER_PATH,
                rules: { semi: "error" },
                useEslintrc: false,
            })
            const report = cli.executeOnFiles(["empty-script.vue"])
            const messages = report.results[0].messages

            assert(messages.length === 0)
        })
    })

    describe("About fixtures/no-end-script-tag.vue", () => {
        it("should notify no error", () => {
            const cli = new CLIEngine({
                cwd: FIXTURE_DIR,
                envs: ["es6", "node"],
                parser: PARSER_PATH,
                rules: { semi: "error" },
                useEslintrc: false,
            })
            const report = cli.executeOnFiles(["no-end-script-tag.vue"])
            const messages = report.results[0].messages

            assert(messages.length === 0)
        })
    })

    describe("About fixtures/notvue.js", () => {
        it("should notify a 'semi' error", () => {
            const cli = new CLIEngine({
                cwd: FIXTURE_DIR,
                envs: ["es6", "node"],
                parser: PARSER_PATH,
                rules: { semi: "error" },
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
                rules: { semi: "error" },
                useEslintrc: false,
            })
            CLIEngine.outputFixes(cli.executeOnFiles(["notvue.js"]))

            const actual = fs.readFileSync(path.join(FIXTURE_DIR, "notvue.js"), "utf8")
            const expected = fs.readFileSync(path.join(FIXTURE_DIR, "notvue.js.fixed"), "utf8")

            assert(actual === expected)
        })
    })

    describe("About fixtures/crlf.vue", () => {
        it("should notify no 'indent' error", () => {
            const cli = new CLIEngine({
                cwd: FIXTURE_DIR,
                envs: ["es6", "node"],
                parser: PARSER_PATH,
                rules: { indent: "error" },
                useEslintrc: false,
            })
            const report = cli.executeOnFiles(["crlf.vue"])
            const messages = report.results[0].messages

            assert(messages.length === 0)
        })
    })

    describe("About fixtures/typed.js", () => {
        it("should notify no error with 'babel-eslint'", () => {
            const cli = new CLIEngine({
                cwd: FIXTURE_DIR,
                envs: ["es6", "node"],
                parser: PARSER_PATH,
                parserOptions: {
                    parser: "babel-eslint",
                    sourceType: "module",
                },
                rules: { semi: ["error", "never"] },
                useEslintrc: false,
            })
            const report = cli.executeOnFiles(["typed.js"])
            const messages = report.results[0].messages

            assert(messages.length === 0)
        })

        it("should notify no error with 'typescript-eslint-parser'", () => {
            const cli = new CLIEngine({
                cwd: FIXTURE_DIR,
                envs: ["es6", "node"],
                parser: PARSER_PATH,
                parserOptions: { //
                    parser: "typescript-eslint-parser",
                },
                rules: { semi: ["error", "never"] },
                useEslintrc: false,
            })
            const report = cli.executeOnFiles(["typed.js"])
            const messages = report.results[0].messages

            assert(messages.length === 0)
        })
    })

    describe("About fixtures/typed.vue", () => {
        it("should notify no error with 'babel-eslint'", () => {
            const cli = new CLIEngine({
                cwd: FIXTURE_DIR,
                envs: ["es6", "node"],
                parser: PARSER_PATH,
                parserOptions: {
                    parser: "babel-eslint",
                    sourceType: "module",
                },
                rules: { semi: ["error", "never"] },
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
                parserOptions: { //
                    parser: "typescript-eslint-parser",
                },
                rules: { semi: ["error", "never"] },
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
                rules: { semi: ["error", "always"] },
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
                rules: { semi: ["error", "always"] },
                useEslintrc: false,
            })
            CLIEngine.outputFixes(cli.executeOnFiles(["typed.vue"]))

            const actual = fs.readFileSync(path.join(FIXTURE_DIR, "typed.vue"), "utf8")
            const expected = fs.readFileSync(path.join(FIXTURE_DIR, "typed.vue.fixed"), "utf8")

            assert(actual === expected)
        })
    })

    describe("About fixtures/svg-attrs.vue", () => {
        it("parses attributes with colons", () => {
            const cli = new CLIEngine({
                cwd: FIXTURE_DIR,
                envs: ["es6", "node"],
                parser: PARSER_PATH,
                useEslintrc: false,
            })
            const report = cli.executeOnFiles(["svg-attrs-colon.vue"])
            const messages = report.results[0].messages

            assert(messages.length === 0)
        })

        it("parses camelCased attributes", () => {
            const cli = new CLIEngine({
                cwd: FIXTURE_DIR,
                envs: ["es6", "node"],
                parser: PARSER_PATH,
                useEslintrc: false,
            })
            const report = cli.executeOnFiles(["svg-attrs-camel-case.vue"])
            const messages = report.results[0].messages

            assert(messages.length === 0)
        })
    })

    describe("About fixtures/location-issue-with-babel-eslint.vue", () => {
        it("Identifiers in import declarations should has correct location.", () => {
            const cli = new CLIEngine({
                cwd: FIXTURE_DIR,
                envs: ["browser", "node"],
                parser: PARSER_PATH,
                parserOptions: {
                    parser: "babel-eslint",
                    sourceType: "module",
                    ecmaVersion: 2017,
                },
                rules: {
                    "no-use-before-define": "error",
                },
                useEslintrc: false,
            })
            const report = cli.executeOnFiles(["location-issue-with-babel-eslint.vue"])
            const messages = report.results[0].messages

            assert(messages.length === 0)
        })
    })

    describe("About unexpected-null-character errors", () => {
        it("should keep NULL in DATA state.", () => {
            const ast = parse("<template>\u0000</template>")
            const text = ast.templateBody.children[0]
            const errors = ast.templateBody.errors

            assert.equal(text.value, "\u0000")
            assert.equal(errors.length, 1)
            assert.equal(errors[0].code, "unexpected-null-character")
        })

        it("should replace NULL by U+FFFD REPLACEMENT CHARACTER in RCDATA state.", () => {
            const ast = parse("<template><textarea>\u0000</textarea></template>")
            const text = ast.templateBody.children[0].children[0]
            const errors = ast.templateBody.errors

            assert.equal(text.value, "\uFFFD")
            assert.equal(errors.length, 1)
            assert.equal(errors[0].code, "unexpected-null-character")
        })

        it("should replace NULL by U+FFFD REPLACEMENT CHARACTER in RAWTEXT state.", () => {
            const ast = parse("<template><style>\u0000</style></template>")
            const text = ast.templateBody.children[0].children[0]
            const errors = ast.templateBody.errors

            assert.equal(text.value, "\uFFFD")
            assert.equal(errors.length, 1)
            assert.equal(errors[0].code, "unexpected-null-character")
        })

        it("should replace NULL by U+FFFD REPLACEMENT CHARACTER in TAG_NAME state.", () => {
            const ast = parse("<template><test\u0000></template>")
            const element = ast.templateBody.children[0]
            const errors = ast.templateBody.errors

            assert.equal(element.name, "test\uFFFD")
            assert.equal(errors.length, 1)
            assert.equal(errors[0].code, "unexpected-null-character")
        })

        it("should replace NULL by U+FFFD REPLACEMENT CHARACTER in ATTRIBUTE_NAME state.", () => {
            const ast = parse("<template><div a\u0000></div></template>")
            const attribute = ast.templateBody.children[0].startTag.attributes[0]
            const errors = ast.templateBody.errors

            assert.equal(attribute.key.name, "a\uFFFD")
            assert.equal(errors.length, 1)
            assert.equal(errors[0].code, "unexpected-null-character")
        })

        it("should replace NULL by U+FFFD REPLACEMENT CHARACTER in ATTRIBUTE_VALUE_DOUBLE_QUOTED state.", () => {
            const ast = parse("<template><div a=\"\u0000\"></div></template>")
            const attribute = ast.templateBody.children[0].startTag.attributes[0]
            const errors = ast.templateBody.errors

            assert.equal(attribute.value.value, "\uFFFD")
            assert.equal(errors.length, 1)
            assert.equal(errors[0].code, "unexpected-null-character")
        })

        it("should replace NULL by U+FFFD REPLACEMENT CHARACTER in ATTRIBUTE_VALUE_SINGLE_QUOTED state.", () => {
            const ast = parse("<template><div a='\u0000'></div></template>")
            const attribute = ast.templateBody.children[0].startTag.attributes[0]
            const errors = ast.templateBody.errors

            assert.equal(attribute.value.value, "\uFFFD")
            assert.equal(errors.length, 1)
            assert.equal(errors[0].code, "unexpected-null-character")
        })

        it("should replace NULL by U+FFFD REPLACEMENT CHARACTER in ATTRIBUTE_VALUE_UNQUOTED state.", () => {
            const ast = parse("<template><div a=\u0000></div></template>")
            const attribute = ast.templateBody.children[0].startTag.attributes[0]
            const errors = ast.templateBody.errors

            assert.equal(attribute.value.value, "\uFFFD")
            assert.equal(errors.length, 1)
            assert.equal(errors[0].code, "unexpected-null-character")
        })

        it("should replace NULL by U+FFFD REPLACEMENT CHARACTER in COMMENT state.", () => {
            const ast = parse("<template><!-- \u0000 --></template>")
            const comment = ast.templateBody.comments[0]
            const errors = ast.templateBody.errors

            assert.equal(comment.value, " \uFFFD ")
            assert.equal(errors.length, 1)
            assert.equal(errors[0].code, "unexpected-null-character")
        })

        it("should replace NULL by U+FFFD REPLACEMENT CHARACTER in BOGUS_COMMENT state.", () => {
            const ast = parse("<template><? \u0000 ?></template>")
            const comment = ast.templateBody.comments[0]
            const errors = ast.templateBody.errors

            assert.equal(comment.value, "? \uFFFD ?")
            assert.equal(errors.length, 1)
            assert.equal(errors[0].code, "unexpected-question-mark-instead-of-tag-name")
        })

        it("should not error in CDATA section state.", () => {
            const ast = parse("<template><svg><![CDATA[\u0000]]></template>")
            const cdata = ast.templateBody.children[0].children[0]
            const errors = ast.templateBody.errors

            assert.equal(cdata.value, "\u0000")
            assert.equal(errors.length, 0)
        })
    })

    describe("About parserServices", () => {
        it("should exist if the source code is a Vue SFC file.", () => {
            assert.notEqual(parseForESLint("test", { filePath: "test.vue" }).services, undefined)
        })

        it("should exist even if the source code is not Vue SFC file.", () => {
            assert.notEqual(parseForESLint("test", { filePath: "test.js" }).services, undefined)
        })
    })
})
