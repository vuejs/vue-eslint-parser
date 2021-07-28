/**
 * @author Yosuke Ota <https://github.com/ota-meshi>
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const assert = require("assert")
const path = require("path")
const eslint = require("eslint")
const Linter = eslint.Linter

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const PARSER_PATH = path.resolve(__dirname, "../src/index.ts")

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("parserServices.defineDocumentVisitor tests", () => {
    it("should be able to visit the document using defineDocumentVisitor.", () => {
        const code = `
<template>
{{forbidden}}
{{foo()}}
{{ok}}
</template>
<style>
.ng {
    font: v-bind(forbidden)
}
.call {
    font: v-bind('foo()')
}
.ok {
    font: v-bind(ok)
}
</style>`

        const linter = new Linter()

        linter.defineParser(PARSER_PATH, require(PARSER_PATH))
        linter.defineRule("test-no-forbidden", {
            create(context) {
                return context.parserServices.defineDocumentVisitor({
                    'Identifier[name="forbidden"]'(node) {
                        context.report({
                            node,
                            message: 'no "forbidden"',
                        })
                    },
                })
            },
        })
        linter.defineRule("test-no-call", {
            create(context) {
                return context.parserServices.defineDocumentVisitor({
                    CallExpression(node) {
                        context.report({
                            node,
                            message: "no call",
                        })
                    },
                })
            },
        })
        const messages = linter.verify(code, {
            parser: PARSER_PATH,
            parserOptions: {
                ecmaVersion: 2018,
            },
            rules: {
                "test-no-forbidden": "error",
                "test-no-call": "error",
            },
        })
        assert.strictEqual(messages.length, 4)
        assert.strictEqual(messages[0].message, 'no "forbidden"')
        assert.strictEqual(messages[0].line, 3)
        assert.strictEqual(messages[1].message, "no call")
        assert.strictEqual(messages[1].line, 4)
        assert.strictEqual(messages[2].message, 'no "forbidden"')
        assert.strictEqual(messages[2].line, 9)
        assert.strictEqual(messages[3].message, "no call")
        assert.strictEqual(messages[3].line, 12)
    })
})
