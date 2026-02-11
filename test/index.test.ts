/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

import type { Rule } from "eslint"
import path from "node:path"
import { describe, it, assert, beforeEach, afterEach } from "vitest"
import tsParser from "@typescript-eslint/parser"
import fs from "node:fs"
import eslint from "eslint"
import semver from "semver"
import { parse, parseForESLint } from "../src"
import * as parser from "../src"
import type { Node, VAttribute, VElement, VText } from "../src/ast"

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

// eslint-disable-next-line no-undef
const ORIGINAL_FIXTURE_DIR = path.join(__dirname, "fixtures")
// eslint-disable-next-line no-undef
const FIXTURE_DIR = path.join(__dirname, "temp")

const BABEL_PARSER_OPTIONS = {
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

const isESLintV10 = semver.satisfies(
    require("eslint/package.json").version, // eslint-disable-line @typescript-eslint/no-require-imports
    ">=10",
)

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("Basic tests", async () => {
    const ESLint = await eslint.loadESLint({ useFlatConfig: true })
    const Linter = class extends eslint.Linter {
        // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
        constructor() {
            super({ configType: "flat" })
        }
    }
    beforeEach(() => {
        fs.rmSync(FIXTURE_DIR, { recursive: true, force: true })
        for (const fileName of fs.readdirSync(ORIGINAL_FIXTURE_DIR)) {
            const src = path.join(ORIGINAL_FIXTURE_DIR, fileName)
            const dst = path.join(FIXTURE_DIR, fileName)

            if (fs.statSync(src).isFile()) {
                // eslint-disable-next-line node/no-unsupported-features/node-builtins
                fs.cpSync(src, dst)
            }
        }
    })
    afterEach(() => {
        fs.rmSync(FIXTURE_DIR, { recursive: true, force: true })
    })

    describe("About fixtures/hello.vue", () => {
        it("should notify 2 'semi' errors", async () => {
            const cli = new ESLint({
                cwd: FIXTURE_DIR,
                overrideConfig: {
                    files: ["*.vue"],
                    languageOptions: {
                        parser,
                        globals: {},
                    },
                    rules: { semi: "error" },
                },
                overrideConfigFile: true,
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
                    files: ["*.vue"],
                    languageOptions: {
                        parser,
                        globals: {},
                    },
                    rules: { semi: "error" },
                },
                overrideConfigFile: true,
            })
            await ESLint.outputFixes(await cli.lintFiles(["hello.vue"]))

            const actual = fs.readFileSync(
                path.join(FIXTURE_DIR, "hello.vue"),
                "utf8",
            )
            const expected = fs.readFileSync(
                path.join(FIXTURE_DIR, "hello.vue.fixed"),
                "utf8",
            )

            assert(actual === expected)
        })
    })

    describe("About fixtures/empty.vue", () => {
        it("should notify no error", async () => {
            const cli = new ESLint({
                cwd: FIXTURE_DIR,
                overrideConfig: {
                    files: ["*.vue"],
                    languageOptions: {
                        parser,
                        globals: {},
                    },
                    rules: { semi: "error" },
                },
                overrideConfigFile: true,
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
                    files: ["*.vue"],
                    languageOptions: {
                        parser,
                        globals: {},
                    },
                    rules: { semi: "error" },
                },
                overrideConfigFile: true,
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
                    files: ["*.vue"],
                    languageOptions: {
                        parser,
                        globals: {},
                    },
                    rules: { semi: "error" },
                },
                overrideConfigFile: true,
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
                    files: ["*.vue"],
                    languageOptions: {
                        parser,
                        globals: {},
                    },
                    rules: { semi: "error" },
                },
                overrideConfigFile: true,
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
                    files: ["*.js"],
                    languageOptions: {
                        parser,
                        globals: {},
                    },
                    rules: { semi: "error" },
                },
                overrideConfigFile: true,
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
                    files: ["*.js"],
                    languageOptions: {
                        parser,
                        globals: {},
                    },
                    rules: { semi: "error" },
                },
                overrideConfigFile: true,
            })
            await ESLint.outputFixes(await cli.lintFiles(["notvue.js"]))

            const actual = fs.readFileSync(
                path.join(FIXTURE_DIR, "notvue.js"),
                "utf8",
            )
            const expected = fs.readFileSync(
                path.join(FIXTURE_DIR, "notvue.js.fixed"),
                "utf8",
            )

            assert.strictEqual(actual, expected)
        })
    })

    describe("About fixtures/crlf.vue", () => {
        it("should notify no 'indent' error", async () => {
            const cli = new ESLint({
                cwd: FIXTURE_DIR,
                overrideConfig: {
                    files: ["*.vue"],
                    languageOptions: {
                        parser,
                        globals: {},
                    },
                    rules: { indent: "error" },
                },
                overrideConfigFile: true,
            })
            const report = await cli.lintFiles(["crlf.vue"])
            const messages = report[0].messages

            assert.deepStrictEqual(messages, [])
        })
    })

    describe("About fixtures/typed.js", () => {
        it.skipIf(isESLintV10)(
            "should notify no error with '@babel/eslint-parser'",
            async () => {
                const cli = new ESLint({
                    cwd: FIXTURE_DIR,
                    overrideConfig: {
                        files: ["*.js"],
                        languageOptions: {
                            parser,
                            globals: {},
                            parserOptions: {
                                ...BABEL_PARSER_OPTIONS,
                                sourceType: "module",
                            },
                        },
                        rules: { semi: ["error", "never"] },
                    },
                    overrideConfigFile: true,
                })
                const report = await cli.lintFiles(["typed.js"])
                const messages = report[0].messages

                assert.deepStrictEqual(messages, [])
            },
        )

        it("should notify no error with '@typescript-eslint/parser'", async () => {
            const cli = new ESLint({
                cwd: FIXTURE_DIR,
                overrideConfig: {
                    files: ["*.js"],
                    languageOptions: {
                        parser,
                        globals: {},
                        parserOptions: {
                            parser: "@typescript-eslint/parser",
                        },
                    },
                    rules: { semi: ["error", "never"] },
                },
                overrideConfigFile: true,
            })
            const report = await cli.lintFiles(["typed.js"])
            const messages = report[0].messages

            assert.deepStrictEqual(messages, [])
        })

        it("should notify no error with multiple parser with '@typescript-eslint/parser'", async () => {
            const cli = new ESLint({
                cwd: FIXTURE_DIR,
                overrideConfig: {
                    files: ["*.ts", "*.tsx"],
                    languageOptions: {
                        parser,
                        globals: {},
                        parserOptions: {
                            parser: {
                                ts: "@typescript-eslint/parser",
                            },
                        },
                    },
                    rules: { semi: ["error", "never"] },
                },
                overrideConfigFile: true,
            })
            const report = await cli.lintFiles(["typed.ts", "typed.tsx"])

            assert.deepStrictEqual(report[0].messages, [])
            assert.deepStrictEqual(report[1].messages, [])
        })

        it("should notify no error with parser object with '@typescript-eslint/parser'", async () => {
            const cli = new ESLint({
                cwd: FIXTURE_DIR,
                overrideConfig: {
                    files: ["*.js"],
                    languageOptions: {
                        parser,
                        globals: {},
                        parserOptions: {
                            parser: tsParser,
                        },
                    },
                    rules: { semi: ["error", "never"] },
                },
                overrideConfigFile: true,
            })
            const report = await cli.lintFiles(["typed.js"])
            const messages = report[0].messages

            assert.deepStrictEqual(messages, [])
        })

        it("should notify no error with multiple parser object with '@typescript-eslint/parser'", async () => {
            const cli = new ESLint({
                cwd: FIXTURE_DIR,
                overrideConfig: {
                    files: ["*.ts", "*.tsx"],
                    languageOptions: {
                        parser,
                        globals: {},
                        parserOptions: {
                            parser: {
                                ts: tsParser,
                            },
                        },
                    },
                    rules: { semi: ["error", "never"] },
                },
                overrideConfigFile: true,
            })
            const report = await cli.lintFiles(["typed.ts", "typed.tsx"])

            assert.deepStrictEqual(report[0].messages, [])
            assert.deepStrictEqual(report[1].messages, [])
        })
    })

    describe("About fixtures/typed.vue", () => {
        it.skipIf(isESLintV10)(
            "should notify no error with '@babel/eslint-parser'",
            async () => {
                const cli = new ESLint({
                    cwd: FIXTURE_DIR,
                    overrideConfig: {
                        files: ["*.vue"],
                        languageOptions: {
                            parser,
                            globals: {},
                            parserOptions: {
                                ...BABEL_PARSER_OPTIONS,
                            },
                        },
                        rules: { semi: ["error", "never"] },
                    },
                    overrideConfigFile: true,
                })
                const report = await cli.lintFiles(["typed.vue"])
                const messages = report[0].messages

                assert.deepStrictEqual(messages, [])
            },
        )

        it("should notify no error with '@typescript-eslint/parser'", async () => {
            const cli = new ESLint({
                cwd: FIXTURE_DIR,
                overrideConfig: {
                    files: ["*.vue"],
                    languageOptions: {
                        parser,
                        globals: {},
                        parserOptions: {
                            parser: "@typescript-eslint/parser",
                        },
                    },
                    rules: { semi: ["error", "never"] },
                },
                overrideConfigFile: true,
            })
            const report = await cli.lintFiles(["typed.vue"])
            const messages = report[0].messages

            assert.deepStrictEqual(messages, [])
        })

        it.skipIf(isESLintV10)(
            "should fix 'semi' errors with --fix option with '@babel/eslint-parser'",
            async () => {
                const cli = new ESLint({
                    cwd: FIXTURE_DIR,
                    fix: true,
                    overrideConfig: {
                        files: ["*.vue"],
                        languageOptions: {
                            parser,
                            globals: {},
                            parserOptions: {
                                ...BABEL_PARSER_OPTIONS,
                            },
                        },
                        rules: { semi: ["error", "always"] },
                    },
                    overrideConfigFile: true,
                })
                await ESLint.outputFixes(await cli.lintFiles(["typed.vue"]))

                const actual = fs.readFileSync(
                    path.join(FIXTURE_DIR, "typed.vue"),
                    "utf8",
                )
                const expected = fs.readFileSync(
                    path.join(FIXTURE_DIR, "typed.vue.fixed"),
                    "utf8",
                )

                assert(actual === expected)
            },
        )

        it("should fix 'semi' errors with --fix option with '@typescript-eslint/parser'", async () => {
            const cli = new ESLint({
                cwd: FIXTURE_DIR,
                fix: true,
                overrideConfig: {
                    files: ["*.vue"],
                    languageOptions: {
                        parser,
                        globals: {},
                        parserOptions: {
                            parser: "@typescript-eslint/parser",
                        },
                    },
                    rules: { semi: ["error", "always"] },
                },
                overrideConfigFile: true,
            })
            await ESLint.outputFixes(await cli.lintFiles(["typed.vue"]))

            const actual = fs.readFileSync(
                path.join(FIXTURE_DIR, "typed.vue"),
                "utf8",
            )
            const expected = fs.readFileSync(
                path.join(FIXTURE_DIR, "typed.vue.fixed"),
                "utf8",
            )

            assert.strictEqual(actual, expected)
        })
    })

    describe("About fixtures/ts-scope-manager.vue", () => {
        it("should calculate the correct location with '@typescript-eslint/parser'", async () => {
            const cli = new ESLint({
                cwd: FIXTURE_DIR,
                overrideConfig: {
                    files: ["*.vue"],
                    languageOptions: {
                        parser,
                        globals: {},
                        parserOptions: {
                            parser: "@typescript-eslint/parser",
                        },
                    },
                    rules: { "no-unused-vars": ["error"] },
                },
                overrideConfigFile: true,
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

    describe("About fixtures/svg-attrs.vue", () => {
        it("parses attributes with colons", async () => {
            const cli = new ESLint({
                cwd: FIXTURE_DIR,
                overrideConfig: {
                    files: ["*.vue"],
                    languageOptions: {
                        parser,
                        globals: {},
                    },
                },
                overrideConfigFile: true,
            })
            const report = await cli.lintFiles(["svg-attrs-colon.vue"])
            const messages = report[0].messages

            assert.deepStrictEqual(messages, [])
        })

        it("parses camelCased attributes", async () => {
            const cli = new ESLint({
                cwd: FIXTURE_DIR,
                overrideConfig: {
                    files: ["*.vue"],
                    languageOptions: {
                        parser,
                        globals: {},
                    },
                },
                overrideConfigFile: true,
            })
            const report = await cli.lintFiles(["svg-attrs-camel-case.vue"])
            const messages = report[0].messages

            assert.deepStrictEqual(messages, [])
        })
    })

    describe.skipIf(isESLintV10)(
        "About fixtures/location-issue-with-babel-eslint.vue",
        () => {
            it("Identifiers in import declarations should has correct location.", async () => {
                const cli = new ESLint({
                    cwd: FIXTURE_DIR,
                    overrideConfig: {
                        files: ["*.vue"],
                        languageOptions: {
                            parser,
                            parserOptions: {
                                ...BABEL_PARSER_OPTIONS,
                                sourceType: "module",
                                ecmaVersion: "latest",
                            },
                            globals: {},
                        },
                        rules: {
                            "no-use-before-define": "error",
                        },
                    },
                    overrideConfigFile: true,
                })
                const report = await cli.lintFiles([
                    "location-issue-with-babel-eslint.vue",
                ])
                const messages = report[0].messages

                assert.deepStrictEqual(messages, [])
            })
        },
    )

    describe("About unexpected-null-character errors", () => {
        it("should keep NULL in DATA state.", () => {
            const ast = parse("<template>\u0000</template>")
            const text = ast.templateBody!.children[0] as VText
            const errors = ast.templateBody!.errors

            assert.strictEqual(text.value, "\u0000")
            assert.strictEqual(errors.length, 1)
            assert.strictEqual(errors[0].code, "unexpected-null-character")
        })

        it("should replace NULL by U+FFFD REPLACEMENT CHARACTER in RCDATA state.", () => {
            const ast = parse(
                "<template><textarea>\u0000</textarea></template>",
            )
            const text = (ast.templateBody!.children[0] as VElement)
                .children[0] as VText
            const errors = ast.templateBody!.errors

            assert.strictEqual(text.value, "\uFFFD")
            assert.strictEqual(errors.length, 1)
            assert.strictEqual(errors[0].code, "unexpected-null-character")
        })

        it("should replace NULL by U+FFFD REPLACEMENT CHARACTER in RAWTEXT state.", () => {
            const ast = parse("<template><style>\u0000</style></template>")
            const text = (ast.templateBody!.children[0] as VElement)
                .children[0] as VText
            const errors = ast.templateBody!.errors

            assert.strictEqual(text.value, "\uFFFD")
            assert.strictEqual(errors.length, 1)
            assert.strictEqual(errors[0].code, "unexpected-null-character")
        })

        it("should replace NULL by U+FFFD REPLACEMENT CHARACTER in TAG_NAME state.", () => {
            const ast = parse("<template><test\u0000></template>")
            const element = ast.templateBody!.children[0] as VElement
            const errors = ast.templateBody!.errors

            assert.strictEqual(element.name, "test\uFFFD")
            assert.strictEqual(errors.length, 1)
            assert.strictEqual(errors[0].code, "unexpected-null-character")
        })

        it("should replace NULL by U+FFFD REPLACEMENT CHARACTER in ATTRIBUTE_NAME state.", () => {
            const ast = parse("<template><div a\u0000></div></template>")
            const attribute = (ast.templateBody!.children[0] as VElement)
                .startTag.attributes[0]
            const errors = ast.templateBody!.errors

            assert.strictEqual(attribute.key.name, "a\uFFFD")
            assert.strictEqual(errors.length, 1)
            assert.strictEqual(errors[0].code, "unexpected-null-character")
        })

        it("should replace NULL by U+FFFD REPLACEMENT CHARACTER in ATTRIBUTE_VALUE_DOUBLE_QUOTED state.", () => {
            const ast = parse('<template><div a="\u0000"></div></template>')
            const attribute = (ast.templateBody!.children[0] as VElement)
                .startTag.attributes[0] as VAttribute
            const errors = ast.templateBody!.errors

            assert.strictEqual(attribute.value!.value, "\uFFFD")
            assert.strictEqual(errors.length, 1)
            assert.strictEqual(errors[0].code, "unexpected-null-character")
        })

        it("should replace NULL by U+FFFD REPLACEMENT CHARACTER in ATTRIBUTE_VALUE_SINGLE_QUOTED state.", () => {
            const ast = parse("<template><div a='\u0000'></div></template>")
            const attribute = (ast.templateBody!.children[0] as VElement)
                .startTag.attributes[0] as VAttribute
            const errors = ast.templateBody!.errors

            assert.strictEqual(attribute.value!.value, "\uFFFD")
            assert.strictEqual(errors.length, 1)
            assert.strictEqual(errors[0].code, "unexpected-null-character")
        })

        it("should replace NULL by U+FFFD REPLACEMENT CHARACTER in ATTRIBUTE_VALUE_UNQUOTED state.", () => {
            const ast = parse("<template><div a=\u0000></div></template>")
            const attribute = (ast.templateBody!.children[0] as VElement)
                .startTag.attributes[0] as VAttribute
            const errors = ast.templateBody!.errors

            assert.strictEqual(attribute.value!.value, "\uFFFD")
            assert.strictEqual(errors.length, 1)
            assert.strictEqual(errors[0].code, "unexpected-null-character")
        })

        it("should replace NULL by U+FFFD REPLACEMENT CHARACTER in COMMENT state.", () => {
            const ast = parse("<template><!-- \u0000 --></template>")
            const comment = ast.templateBody!.comments[0]
            const errors = ast.templateBody!.errors

            assert.strictEqual(comment.value, " \uFFFD ")
            assert.strictEqual(errors.length, 1)
            assert.strictEqual(errors[0].code, "unexpected-null-character")
        })

        it("should replace NULL by U+FFFD REPLACEMENT CHARACTER in BOGUS_COMMENT state.", () => {
            const ast = parse("<template><? \u0000 ?></template>")
            const comment = ast.templateBody!.comments[0]
            const errors = ast.templateBody!.errors

            assert.strictEqual(comment.value, "? \uFFFD ?")
            assert.strictEqual(errors.length, 1)
            assert.strictEqual(
                errors[0].code,
                "unexpected-question-mark-instead-of-tag-name",
            )
        })

        it("should not error in CDATA section state.", () => {
            const ast = parse("<template><svg><![CDATA[\u0000]]></template>")
            const cdata = (ast.templateBody!.children[0] as VElement)
                .children[0] as VText
            const errors = ast.templateBody!.errors

            assert.strictEqual(cdata.value, "\u0000")
            assert.strictEqual(errors.length, 0)
        })
    })

    describe("About parserServices", () => {
        it("should exist if the source code is a Vue SFC file.", () => {
            assert.notStrictEqual(
                parseForESLint("test", { filePath: "test.vue" }).services,
                undefined,
            )
        })

        it("should exist even if the source code is not Vue SFC file.", () => {
            assert.notStrictEqual(
                parseForESLint("test", { filePath: "test.js" }).services,
                undefined,
            )
        })
    })

    describe("https://github.com/vuejs/vue-eslint-parser/issues/21", () => {
        it("should make the correct location of decorators", () => {
            const code: string = fs.readFileSync(
                path.join(FIXTURE_DIR, "issue21.vue"),
                "utf8",
            )
            const indexOfDecorator = code.indexOf("@Component")
            const ast = parse(code, {
                ...BABEL_PARSER_OPTIONS,
                ecmaVersion: "latest",
                sourceType: "module",

                // Implicit parserOptions to detect whether the current ESLint supports `result.scopeManager` and `result.visitorKeys`.
                eslintScopeManager: true,
                eslintVisitorKeys: true,
            })

            assert.strictEqual(ast.body[2].range[0], indexOfDecorator)
            assert.strictEqual(
                // TSESLintClassDeclaration
                (ast.body[2] as any).decorators[0].range[0],
                indexOfDecorator,
            )
        })
    })

    describe("parserServices.defineTemplateBodyVisitor", () => {
        it("should work even if AST object was reused.", () => {
            const code = "<template><div/></template>"
            const config: eslint.Linter.Config = {
                languageOptions: {
                    parser,
                },
                plugins: buildPlugins({
                    create(context) {
                        return context.sourceCode.parserServices.defineTemplateBodyVisitor(
                            {
                                "VElement[name='div']"(node: VElement) {
                                    context.report({ node, message: "OK" })
                                },
                            },
                        )
                    },
                }),
                rules: {
                    "test/test-rule": "error",
                },
            }
            const linter = new Linter()
            const messages1 = linter.verify(code, config)
            const messages2 = linter.verify(linter.getSourceCode(), config)

            assert.strictEqual(messages1.length, 1)
            assert.strictEqual(messages1[0].message, "OK")
            assert.strictEqual(messages2.length, 1)
            assert.strictEqual(messages2[0].message, "OK")
        })

        it("should work even if used sibling selector.", () => {
            const code = "<template><div/><div/></template>"
            const config: eslint.Linter.Config = {
                languageOptions: {
                    parser,
                },
                plugins: buildPlugins({
                    create(context) {
                        return context.sourceCode.parserServices.defineTemplateBodyVisitor(
                            {
                                "* ~ *"(node: Node) {
                                    context.report({
                                        node,
                                        message: "OK",
                                    })
                                },
                            },
                        )
                    },
                }),
                rules: {
                    "test/test-rule": "error",
                },
            }
            const linter = new Linter()
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
                languageOptions: {
                    parser,
                },
            }
            const linter = new Linter()
            const messages = linter.verify(code, config)

            assert.strictEqual(messages.length, 1)
            // assert.strictEqual(
            //     messages[0].message,
            //     "Parsing error: Unterminated comment"
            // )
        })
        it("should notify parsing error #2", () => {
            const code = "<script>var a = `</script><script setup>`</script>"
            const config: eslint.Linter.Config = {
                languageOptions: {
                    parser,
                    parserOptions: {
                        ecmaVersion: "latest",
                    },
                },
            }
            const linter = new Linter()
            const messages = linter.verify(code, config)

            assert.strictEqual(messages.length, 1)
            assert.strictEqual(
                messages[0].message,
                "Parsing error: Unterminated template literal",
            )
        })
        it("should notify parsing error #3", () => {
            const code = '<script>var a = "</script><script setup>"</script>'
            const config = {
                languageOptions: {
                    parser,
                },
            }
            const linter = new Linter()
            const messages = linter.verify(code, config)

            assert.strictEqual(messages.length, 1)
            assert.strictEqual(
                messages[0].message,
                "Parsing error: Unterminated string constant",
            )
        })
        it("should notify 1 no-undef error", () => {
            const code =
                "<script>var a = 1, b = 2;</script><script setup>c = a + b</script>"
            const config: eslint.Linter.Config = {
                languageOptions: {
                    parser,
                },
                rules: {
                    "no-undef": "error",
                },
            }
            const linter = new Linter()
            const messages = linter.verify(code, config)

            assert.strictEqual(messages.length, 1)
            assert.strictEqual(messages[0].message, "'c' is not defined.")
        })

        it("should sort comments by their original source position", () => {
            const code = `<script lang="ts" setup>
const test = () => {
  // first
  return false
}
</script>

<script lang="ts">
/**
 * second
 */
export default {}
</script>

<template>
  <div @click="test" />
</template>`

            const result = parseForESLint(code, { sourceType: "module" })
            const comments = result.ast.comments!

            // Should have 2 comments
            assert.strictEqual(comments.length, 2)

            // Comments should be sorted by their original position in source code
            assert.strictEqual(comments[0].type, "Line")
            assert.strictEqual(comments[0].value, " first")
            assert.strictEqual(comments[0].loc.start.line, 3)

            assert.strictEqual(comments[1].type, "Block")
            assert.strictEqual(comments[1].value, "*\n * second\n ")
            assert.strictEqual(comments[1].loc.start.line, 9)

            // Verify comments are sorted by range
            assert.ok(comments[0].range[0] < comments[1].range[0])
        })
    })
})

function buildPlugins(rule: Rule.RuleModule) {
    return {
        test: {
            rules: {
                "test-rule": rule,
            },
        },
    }
}
