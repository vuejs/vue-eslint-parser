/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * See LICENSE file in root directory for full license.
 */

import { describe, it, assert } from "vitest"
import { parseForESLint } from "../src"
import { Linter } from "eslint"

describe("parserOptions", () => {
    describe("parser", () => {
        const linter = new Linter({ configType: "flat" })
        const parser = { parseForESLint }
        const plugin = {
            rules: {
                "template-test": {
                    create(context) {
                        return {
                            Program(node) {
                                const element = node.templateBody
                                if (element != null) {
                                    context.report({ node, message: "test" })
                                }
                            },
                        }
                    },
                },
            },
        }

        it("false then skip parsing '<script>'.", () => {
            const code = `<template>Hello</template>
<script>This is syntax error</script>`
            const config: Linter.Config = {
                files: ["*.vue"],
                plugins: {
                    vue: plugin,
                },
                languageOptions: {
                    parser,
                    parserOptions: {
                        parser: false,
                    },
                },
                rules: {
                    "vue/template-test": "error",
                },
            }
            const messages = linter.verify(code, config, "test.vue")

            assert.strictEqual(messages.length, 1)
            assert.strictEqual(messages[0].ruleId, "vue/template-test")
        })

        it("Fail in <script setup> with sourceType: script.", () => {
            const code = `<template>Hello</template>
<script setup>import Foo from './foo'</script>`
            const config: Linter.Config = {
                files: ["*.vue"],
                plugins: {
                    vue: plugin,
                },
                languageOptions: {
                    parser,
                    sourceType: "script",
                    parserOptions: {},
                },
                rules: {},
            }
            const messages = linter.verify(code, config, "test.vue")

            assert.strictEqual(messages.length, 1)
            assert.strictEqual(messages[0].fatal, true)
        })
    })
})
