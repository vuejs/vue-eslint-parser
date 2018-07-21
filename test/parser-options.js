/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * See LICENSE file in root directory for full license.
 */
"use strict"

const assert = require("assert")
const { rules } = require("@mysticatea/eslint-plugin")
const parseForESLint = require("..").parseForESLint
const eslint = require("./fixtures/eslint")
const Linter = eslint.Linter

describe.only("parserOptions", () => {
    describe("parser", () => {
        const linter = new Linter()
        linter.defineParser("vue-eslint-parser", { parseForESLint })
        linter.defineRule(
            "vue/valid-template-root",
            rules["vue/valid-template-root"]
        )

        it("false then skip parsing '<script>'.", () => {
            const code = `<template>Hello</template>
<script>This is syntax error</script>`
            const config = {
                parser: "vue-eslint-parser",
                parserOptions: {
                    parser: false,
                },
                rules: {
                    "vue/valid-template-root": "error",
                },
            }
            const messages = linter.verify(code, config, "test.vue")

            assert.strictEqual(messages.length, 1)
            assert.strictEqual(messages[0].ruleId, "vue/valid-template-root")
        })
    })
})
