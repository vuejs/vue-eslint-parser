/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * See LICENSE file in root directory for full license.
 */
"use strict"

const assert = require("assert")
const { parseForESLint } = require("../src")
const eslint = require("./fixtures/eslint")
const Linter = eslint.Linter

describe("parserOptions", () => {
    describe("parser", () => {
        const linter = new Linter()
        linter.defineParser("vue-eslint-parser", { parseForESLint })
        linter.defineRule("vue/template-test", {
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
        })

        it("false then skip parsing '<script>'.", () => {
            const code = `<template>Hello</template>
<script>This is syntax error</script>`
            const config = {
                parser: "vue-eslint-parser",
                parserOptions: {
                    parser: false,
                },
                rules: {
                    "vue/template-test": "error",
                },
            }
            const messages = linter.verify(code, config, "test.vue")

            assert.strictEqual(messages.length, 1)
            assert.strictEqual(messages[0].ruleId, "vue/template-test")
        })

        it("Fail in <script setup> without sourceType.", () => {
            const code = `<template>Hello</template>
<script setup>import Foo from './foo'</script>`
            const config = {
                parser: "vue-eslint-parser",
                parserOptions: {},
                rules: {},
            }
            const messages = linter.verify(code, config, "test.vue")

            assert.strictEqual(messages.length, 1)
            assert.strictEqual(messages[0].fatal, true)
        })
    })
})
