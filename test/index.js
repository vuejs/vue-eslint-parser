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
const semver = require("semver")
const parse = require("../src").parse
const parseForESLint = require("../src").parseForESLint
const eslint = require("./lib/eslint-compat")(require("./fixtures/eslint"))
const ESLint = eslint.ESLint
const Linter = eslint.Linter

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const ORIGINAL_FIXTURE_DIR = path.join(__dirname, "fixtures")
const FIXTURE_DIR = path.join(__dirname, "temp")
const PARSER_PATH = path.resolve(__dirname, "../src/index.ts")

const BABEL_PARSER_OPTIONS = semver.satisfies(ESLint.version, "<8")
    ? {
          parser: "babel-eslint",
      }
    : {
          parser: "@babel/eslint-parser",
          requireConfigFile: false,
          babelOptions: {
              plugins: [
                  "@babel/plugin-syntax-typescript",
                  [
                      "@babel/plugin-syntax-decorators",
                      {
                          decoratorsBeforeExport: true,
                      },
                  ],
              ],
          },
      }
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
        it("should notify 2 'semi' errors", async () => {
            const cli = new ESLint({
                cwd: FIXTURE_DIR,
                overrideConfig: {
                    env: { es6: true, node: true },
                    parser: PARSER_PATH,
                    rules: { semi: "error" },
                },
                useEslintrc: false,
            })
            const report = await cli.lintFiles(["hello.vue"])
            const messages = report[0].messages

            assert(messages.length === 2)
            assert(messages[0].ruleId === "semi")
            assert(messages[0].line === 8)
            assert(messages[0].column === 35)
            assert(messages[1].ruleId === "semi")
            assert(messages[1].line === 10)
            assert(messages[1].column === 2)
        })

        it("should fix 2 'semi' errors with --fix option", async () => {
            const cli = new ESLint({
                cwd: FIXTURE_DIR,
                fix: true,
                overrideConfig: {
                    env: { es6: true, node: true },
                    parser: PARSER_PATH,
                    rules: { semi: "error" },
                },
                useEslintrc: false,
            })
            await ESLint.outputFixes(await cli.lintFiles(["hello.vue"]))

            const actual = fs.readFileSync(
                path.join(FIXTURE_DIR, "hello.vue"),
                "utf8"
            )
            const expected = fs.readFileSync(
                path.join(FIXTURE_DIR, "hello.vue.fixed"),
                "utf8"
            )

            assert(actual === expected)
        })
    })

    describe("About fixtures/empty.vue", () => {
        it("should notify no error", async () => {
            const cli = new ESLint({
                cwd: FIXTURE_DIR,
                overrideConfig: {
                    env: { es6: true, node: true },
                    parser: PARSER_PATH,
                    rules: { semi: "error" },
                },
                useEslintrc: false,
            })
            const report = await cli.lintFiles(["empty.vue"])
            const messages = report[0].messages

            assert.deepStrictEqual(messages, [])
        })
    })

    describe("About fixtures/no-script.vue", () => {
        it("should notify no error", async () => {
            const cli = new ESLint({
                cwd: FIXTURE_DIR,
                overrideConfig: {
                    env: { es6: true, node: true },
                    parser: PARSER_PATH,
                    rules: { semi: "error" },
                },
                useEslintrc: false,
            })
            const report = await cli.lintFiles(["no-script.vue"])
            const messages = report[0].messages

            assert.deepStrictEqual(messages, [])
        })
    })

    describe("About fixtures/empty-script.vue", () => {
        it("should notify no error", async () => {
            const cli = new ESLint({
                cwd: FIXTURE_DIR,
                overrideConfig: {
                    env: { es6: true, node: true },
                    parser: PARSER_PATH,
                    rules: { semi: "error" },
                },
                useEslintrc: false,
            })
            const report = await cli.lintFiles(["empty-script.vue"])
            const messages = report[0].messages

            assert.deepStrictEqual(messages, [])
        })
    })

    describe("About fixtures/no-end-script-tag.vue", () => {
        it("should notify no error", async () => {
            const cli = new ESLint({
                cwd: FIXTURE_DIR,
                overrideConfig: {
                    env: { es6: true, node: true },
                    parser: PARSER_PATH,
                    rules: { semi: "error" },
                },
                useEslintrc: false,
            })
            const report = await cli.lintFiles(["no-end-script-tag.vue"])
            const messages = report[0].messages

            assert.deepStrictEqual(messages, [])
        })
    })

    describe("About fixtures/notvue.js", () => {
        it("should notify a 'semi' error", async () => {
            const cli = new ESLint({
                cwd: FIXTURE_DIR,
                overrideConfig: {
                    env: { es6: true, node: true },
                    parser: PARSER_PATH,
                    rules: { semi: "error" },
                },
                useEslintrc: false,
            })
            const report = await cli.lintFiles(["notvue.js"])
            const messages = report[0].messages

            assert(messages.length === 1)
            assert(messages[0].ruleId === "semi")
            assert(messages[0].line === 1)
            assert(messages[0].column === 21)
        })

        it("should fix a 'semi' error with --fix option", async () => {
            const cli = new ESLint({
                cwd: FIXTURE_DIR,
                fix: true,
                overrideConfig: {
                    env: { es6: true, node: true },
                    parser: PARSER_PATH,
                    rules: { semi: "error" },
                },
                useEslintrc: false,
            })
            await ESLint.outputFixes(await cli.lintFiles(["notvue.js"]))

            const actual = fs.readFileSync(
                path.join(FIXTURE_DIR, "notvue.js"),
                "utf8"
            )
            const expected = fs.readFileSync(
                path.join(FIXTURE_DIR, "notvue.js.fixed"),
                "utf8"
            )

            assert(actual === expected)
        })
    })

    describe("About fixtures/crlf.vue", () => {
        it("should notify no 'indent' error", async () => {
            const cli = new ESLint({
                cwd: FIXTURE_DIR,
                overrideConfig: {
                    env: { es6: true, node: true },
                    parser: PARSER_PATH,
                    rules: { indent: "error" },
                },
                useEslintrc: false,
            })
            const report = await cli.lintFiles(["crlf.vue"])
            const messages = report[0].messages

            assert.deepStrictEqual(messages, [])
        })
    })

    describe("About fixtures/typed.js", () => {
        it("should notify no error with 'babel-eslint'", async () => {
            const cli = new ESLint({
                cwd: FIXTURE_DIR,
                overrideConfig: {
                    env: { es6: true, node: true },
                    parser: PARSER_PATH,
                    parserOptions: {
                        ...BABEL_PARSER_OPTIONS,
                        sourceType: "module",
                    },
                    rules: { semi: ["error", "never"] },
                },
                useEslintrc: false,
            })
            const report = await cli.lintFiles(["typed.js"])
            const messages = report[0].messages

            assert.deepStrictEqual(messages, [])
        })

        if (semver.gte(process.version, "10.0.0")) {
            it("should notify no error with '@typescript-eslint/parser'", async () => {
                const cli = new ESLint({
                    cwd: FIXTURE_DIR,
                    overrideConfig: {
                        env: { es6: true, node: true },
                        parser: PARSER_PATH,
                        parserOptions: {
                            parser: "@typescript-eslint/parser",
                        },
                        rules: { semi: ["error", "never"] },
                    },
                    useEslintrc: false,
                })
                const report = await cli.lintFiles(["typed.js"])
                const messages = report[0].messages

                assert.deepStrictEqual(messages, [])
            })
        }
    })

    describe("About fixtures/typed.vue", () => {
        it("should notify no error with 'babel-eslint'", async () => {
            const cli = new ESLint({
                cwd: FIXTURE_DIR,
                overrideConfig: {
                    env: { es6: true, node: true },
                    parser: PARSER_PATH,
                    parserOptions: {
                        ...BABEL_PARSER_OPTIONS,
                        sourceType: "module",
                    },
                    rules: { semi: ["error", "never"] },
                },
                useEslintrc: false,
            })
            const report = await cli.lintFiles(["typed.vue"])
            const messages = report[0].messages

            assert.deepStrictEqual(messages, [])
        })

        if (semver.gte(process.version, "10.0.0")) {
            it("should notify no error with '@typescript-eslint/parser'", async () => {
                const cli = new ESLint({
                    cwd: FIXTURE_DIR,
                    overrideConfig: {
                        env: { es6: true, node: true },
                        parser: PARSER_PATH,
                        parserOptions: {
                            parser: "@typescript-eslint/parser",
                        },
                        rules: { semi: ["error", "never"] },
                    },
                    useEslintrc: false,
                })
                const report = await cli.lintFiles(["typed.vue"])
                const messages = report[0].messages

                assert.deepStrictEqual(messages, [])
            })
        }

        it("should fix 'semi' errors with --fix option with 'babel-eslint'", async () => {
            const cli = new ESLint({
                cwd: FIXTURE_DIR,
                fix: true,
                overrideConfig: {
                    env: { es6: true, node: true },
                    parser: PARSER_PATH,
                    parserOptions: {
                        ...BABEL_PARSER_OPTIONS,
                        sourceType: "module",
                    },
                    rules: { semi: ["error", "always"] },
                },
                useEslintrc: false,
            })
            await ESLint.outputFixes(await cli.lintFiles(["typed.vue"]))

            const actual = fs.readFileSync(
                path.join(FIXTURE_DIR, "typed.vue"),
                "utf8"
            )
            const expected = fs.readFileSync(
                path.join(FIXTURE_DIR, "typed.vue.fixed"),
                "utf8"
            )

            assert(actual === expected)
        })

        if (semver.gte(process.version, "10.0.0")) {
            it("should fix 'semi' errors with --fix option with '@typescript-eslint/parser'", async () => {
                const cli = new ESLint({
                    cwd: FIXTURE_DIR,
                    fix: true,
                    overrideConfig: {
                        env: { es6: true, node: true },
                        parser: PARSER_PATH,
                        parserOptions: {
                            parser: "@typescript-eslint/parser",
                        },
                        rules: { semi: ["error", "always"] },
                    },
                    useEslintrc: false,
                })
                await ESLint.outputFixes(await cli.lintFiles(["typed.vue"]))

                const actual = fs.readFileSync(
                    path.join(FIXTURE_DIR, "typed.vue"),
                    "utf8"
                )
                const expected = fs.readFileSync(
                    path.join(FIXTURE_DIR, "typed.vue.fixed"),
                    "utf8"
                )

                assert(actual === expected)
            })
        }
    })

    if (semver.gte(process.version, "10.0.0")) {
        describe("About fixtures/ts-scope-manager.vue", () => {
            it("should calculate the correct location with '@typescript-eslint/parser'", async () => {
                const cli = new ESLint({
                    cwd: FIXTURE_DIR,
                    overrideConfig: {
                        env: { es6: true, node: true },
                        parser: PARSER_PATH,
                        parserOptions: {
                            parser: "@typescript-eslint/parser",
                        },
                        rules: { "no-unused-vars": ["error"] },
                    },
                    useEslintrc: false,
                })
                const report = await cli.lintFiles(["ts-scope-manager.vue"])
                const messages = report[0].messages

                assert.strictEqual(messages.length, 1)
                assert.deepStrictEqual(messages[0].line, 8)
                assert.deepStrictEqual(messages[0].column, 8)
                assert.deepStrictEqual(messages[0].endLine, 8)
                assert.deepStrictEqual(messages[0].endColumn, 14)
            })
        })
    }

    describe("About fixtures/svg-attrs.vue", () => {
        it("parses attributes with colons", async () => {
            const cli = new ESLint({
                cwd: FIXTURE_DIR,
                overrideConfig: {
                    env: { es6: true, node: true },
                    parser: PARSER_PATH,
                },
                useEslintrc: false,
            })
            const report = await cli.lintFiles(["svg-attrs-colon.vue"])
            const messages = report[0].messages

            assert.deepStrictEqual(messages, [])
        })

        it("parses camelCased attributes", async () => {
            const cli = new ESLint({
                cwd: FIXTURE_DIR,
                overrideConfig: {
                    env: { es6: true, node: true },
                    parser: PARSER_PATH,
                },
                useEslintrc: false,
            })
            const report = await cli.lintFiles(["svg-attrs-camel-case.vue"])
            const messages = report[0].messages

            assert.deepStrictEqual(messages, [])
        })
    })

    describe("About fixtures/location-issue-with-babel-eslint.vue", () => {
        it("Identifiers in import declarations should has correct location.", async () => {
            const cli = new ESLint({
                cwd: FIXTURE_DIR,
                overrideConfig: {
                    env: { browser: true, node: true },
                    parser: PARSER_PATH,
                    parserOptions: {
                        ...BABEL_PARSER_OPTIONS,
                        sourceType: "module",
                        ecmaVersion: 2017,
                    },
                    rules: {
                        "no-use-before-define": "error",
                    },
                },
                useEslintrc: false,
            })
            const report = await cli.lintFiles([
                "location-issue-with-babel-eslint.vue",
            ])
            const messages = report[0].messages

            assert.deepStrictEqual(messages, [])
        })
    })

    describe("About unexpected-null-character errors", () => {
        it("should keep NULL in DATA state.", () => {
            const ast = parse("<template>\u0000</template>")
            const text = ast.templateBody.children[0]
            const errors = ast.templateBody.errors

            assert.strictEqual(text.value, "\u0000")
            assert.strictEqual(errors.length, 1)
            assert.strictEqual(errors[0].code, "unexpected-null-character")
        })

        it("should replace NULL by U+FFFD REPLACEMENT CHARACTER in RCDATA state.", () => {
            const ast = parse(
                "<template><textarea>\u0000</textarea></template>"
            )
            const text = ast.templateBody.children[0].children[0]
            const errors = ast.templateBody.errors

            assert.strictEqual(text.value, "\uFFFD")
            assert.strictEqual(errors.length, 1)
            assert.strictEqual(errors[0].code, "unexpected-null-character")
        })

        it("should replace NULL by U+FFFD REPLACEMENT CHARACTER in RAWTEXT state.", () => {
            const ast = parse("<template><style>\u0000</style></template>")
            const text = ast.templateBody.children[0].children[0]
            const errors = ast.templateBody.errors

            assert.strictEqual(text.value, "\uFFFD")
            assert.strictEqual(errors.length, 1)
            assert.strictEqual(errors[0].code, "unexpected-null-character")
        })

        it("should replace NULL by U+FFFD REPLACEMENT CHARACTER in TAG_NAME state.", () => {
            const ast = parse("<template><test\u0000></template>")
            const element = ast.templateBody.children[0]
            const errors = ast.templateBody.errors

            assert.strictEqual(element.name, "test\uFFFD")
            assert.strictEqual(errors.length, 1)
            assert.strictEqual(errors[0].code, "unexpected-null-character")
        })

        it("should replace NULL by U+FFFD REPLACEMENT CHARACTER in ATTRIBUTE_NAME state.", () => {
            const ast = parse("<template><div a\u0000></div></template>")
            const attribute =
                ast.templateBody.children[0].startTag.attributes[0]
            const errors = ast.templateBody.errors

            assert.strictEqual(attribute.key.name, "a\uFFFD")
            assert.strictEqual(errors.length, 1)
            assert.strictEqual(errors[0].code, "unexpected-null-character")
        })

        it("should replace NULL by U+FFFD REPLACEMENT CHARACTER in ATTRIBUTE_VALUE_DOUBLE_QUOTED state.", () => {
            const ast = parse('<template><div a="\u0000"></div></template>')
            const attribute =
                ast.templateBody.children[0].startTag.attributes[0]
            const errors = ast.templateBody.errors

            assert.strictEqual(attribute.value.value, "\uFFFD")
            assert.strictEqual(errors.length, 1)
            assert.strictEqual(errors[0].code, "unexpected-null-character")
        })

        it("should replace NULL by U+FFFD REPLACEMENT CHARACTER in ATTRIBUTE_VALUE_SINGLE_QUOTED state.", () => {
            const ast = parse("<template><div a='\u0000'></div></template>")
            const attribute =
                ast.templateBody.children[0].startTag.attributes[0]
            const errors = ast.templateBody.errors

            assert.strictEqual(attribute.value.value, "\uFFFD")
            assert.strictEqual(errors.length, 1)
            assert.strictEqual(errors[0].code, "unexpected-null-character")
        })

        it("should replace NULL by U+FFFD REPLACEMENT CHARACTER in ATTRIBUTE_VALUE_UNQUOTED state.", () => {
            const ast = parse("<template><div a=\u0000></div></template>")
            const attribute =
                ast.templateBody.children[0].startTag.attributes[0]
            const errors = ast.templateBody.errors

            assert.strictEqual(attribute.value.value, "\uFFFD")
            assert.strictEqual(errors.length, 1)
            assert.strictEqual(errors[0].code, "unexpected-null-character")
        })

        it("should replace NULL by U+FFFD REPLACEMENT CHARACTER in COMMENT state.", () => {
            const ast = parse("<template><!-- \u0000 --></template>")
            const comment = ast.templateBody.comments[0]
            const errors = ast.templateBody.errors

            assert.strictEqual(comment.value, " \uFFFD ")
            assert.strictEqual(errors.length, 1)
            assert.strictEqual(errors[0].code, "unexpected-null-character")
        })

        it("should replace NULL by U+FFFD REPLACEMENT CHARACTER in BOGUS_COMMENT state.", () => {
            const ast = parse("<template><? \u0000 ?></template>")
            const comment = ast.templateBody.comments[0]
            const errors = ast.templateBody.errors

            assert.strictEqual(comment.value, "? \uFFFD ?")
            assert.strictEqual(errors.length, 1)
            assert.strictEqual(
                errors[0].code,
                "unexpected-question-mark-instead-of-tag-name"
            )
        })

        it("should not error in CDATA section state.", () => {
            const ast = parse("<template><svg><![CDATA[\u0000]]></template>")
            const cdata = ast.templateBody.children[0].children[0]
            const errors = ast.templateBody.errors

            assert.strictEqual(cdata.value, "\u0000")
            assert.strictEqual(errors.length, 0)
        })
    })

    describe("About parserServices", () => {
        it("should exist if the source code is a Vue SFC file.", () => {
            assert.notStrictEqual(
                parseForESLint("test", { filePath: "test.vue" }).services,
                undefined
            )
        })

        it("should exist even if the source code is not Vue SFC file.", () => {
            assert.notStrictEqual(
                parseForESLint("test", { filePath: "test.js" }).services,
                undefined
            )
        })
    })

    describe("https://github.com/vuejs/vue-eslint-parser/issues/21", () => {
        it("should make the correct location of decorators", () => {
            const code = fs.readFileSync(
                path.join(FIXTURE_DIR, "issue21.vue"),
                "utf8"
            )
            const indexOfDecorator = code.indexOf("@Component")
            const ast = parse(code, {
                ...BABEL_PARSER_OPTIONS,
                ecmaVersion: 2017,
                sourceType: "module",

                // Implicit parserOptions to detect whether the current ESLint supports `result.scopeManager` and `result.visitorKeys`.
                eslintScopeManager: true,
                eslintVisitorKeys: true,
            })

            assert.strictEqual(ast.body[2].range[0], indexOfDecorator)
            assert.strictEqual(
                ast.body[2].decorators[0].range[0],
                indexOfDecorator
            )
        })
    })

    describe("parserServices.defineTemplateBodyVisitor", () => {
        it("should work even if AST object was reused.", () => {
            const code = "<template><div/></template>"
            const config = {
                parser: PARSER_PATH,
                rules: {
                    "test-rule": "error",
                },
            }
            const linter = new Linter()

            linter.defineParser(PARSER_PATH, require(PARSER_PATH))
            linter.defineRule("test-rule", (context) =>
                context.parserServices.defineTemplateBodyVisitor({
                    "VElement[name='div']"(node) {
                        context.report({ node, message: "OK" })
                    },
                })
            )

            const messages1 = linter.verify(code, config)
            const messages2 = linter.verify(linter.getSourceCode(), config)

            assert.strictEqual(messages1.length, 1)
            assert.strictEqual(messages1[0].message, "OK")
            assert.strictEqual(messages2.length, 1)
            assert.strictEqual(messages2[0].message, "OK")
        })

        it("should work even if used sibling selector.", () => {
            const code = "<template><div/><div/></template>"
            const config = {
                parser: PARSER_PATH,
                rules: {
                    "test-rule": "error",
                },
            }
            const linter = new Linter()

            linter.defineParser(PARSER_PATH, require(PARSER_PATH))
            linter.defineRule("test-rule", (context) =>
                context.parserServices.defineTemplateBodyVisitor({
                    "* ~ *"(node) {
                        context.report({ node, message: "OK" })
                    },
                })
            )

            const messages1 = linter.verify(code, config)
            const messages2 = linter.verify(linter.getSourceCode(), config)

            assert.strictEqual(messages1.length, 1)
            assert.strictEqual(messages1[0].message, "OK")
            assert.strictEqual(messages2.length, 1)
            assert.strictEqual(messages2[0].message, "OK")
        })
    })

    describe("Multiple <script>", () => {
        it("should notify parsing error", () => {
            const code =
                '<script>"script" /* </script><script setup>/**/</script>'
            const config = {
                parser: PARSER_PATH,
            }
            const linter = new Linter()

            linter.defineParser(PARSER_PATH, require(PARSER_PATH))

            const messages = linter.verify(code, config)

            assert.strictEqual(messages.length, 1)
            // assert.strictEqual(
            //     messages[0].message,
            //     "Parsing error: Unterminated comment"
            // )
        })
        it("should notify parsing error #2", () => {
            const code = "<script>var a = `</script><script setup>`</script>"
            const config = {
                parser: PARSER_PATH,
                parserOptions: {
                    ecmaVersion: 2015,
                },
            }
            const linter = new Linter()

            linter.defineParser(PARSER_PATH, require(PARSER_PATH))

            const messages = linter.verify(code, config)

            assert.strictEqual(messages.length, 1)
            assert.strictEqual(
                messages[0].message,
                "Parsing error: Unterminated template literal"
            )
        })
        it("should notify parsing error #3", () => {
            const code = '<script>var a = "</script><script setup>"</script>'
            const config = {
                parser: PARSER_PATH,
            }
            const linter = new Linter()

            linter.defineParser(PARSER_PATH, require(PARSER_PATH))

            const messages = linter.verify(code, config)

            assert.strictEqual(messages.length, 1)
            assert.strictEqual(
                messages[0].message,
                "Parsing error: Unterminated string constant"
            )
        })
        it("should notify 1 no-undef error", () => {
            const code =
                "<script>var a = 1, b = 2;</script><script setup>c = a + b</script>"
            const config = {
                parser: PARSER_PATH,
                rules: {
                    "no-undef": "error",
                },
            }
            const linter = new Linter()

            linter.defineParser(PARSER_PATH, require(PARSER_PATH))

            const messages = linter.verify(code, config)

            assert.strictEqual(messages.length, 1)
            assert.strictEqual(messages[0].message, "'c' is not defined.")
        })
    })
})
