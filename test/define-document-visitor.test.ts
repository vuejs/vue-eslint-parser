/**
 * @author Yosuke Ota <https://github.com/ota-meshi>
 */

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

import type { ESLint } from "eslint"
import { Linter } from "eslint"
import { assert, describe, it } from "vitest"
import * as parser from "../src/index"
import type { CallExpression, Identifier } from "estree"

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

        const linter = new Linter({ configType: "flat" })

        const rules: ESLint.Plugin["rules"] = {
            "test-no-forbidden": {
                create(context: any) {
                    return context.sourceCode.parserServices.defineDocumentVisitor(
                        {
                            'Identifier[name="forbidden"]'(node: Identifier) {
                                context.report({
                                    node,
                                    message: 'no "forbidden"',
                                })
                            },
                        },
                    )
                },
            },
            "test-no-call": {
                create(context: any) {
                    return context.sourceCode.parserServices.defineDocumentVisitor(
                        {
                            CallExpression(node: CallExpression) {
                                context.report({
                                    node,
                                    message: "no call",
                                })
                            },
                        },
                    )
                },
            },
        }
        const messages = linter.verify(code, {
            plugins: {
                test: {
                    rules,
                },
            },
            languageOptions: {
                parser,
            },
            rules: {
                "test/test-no-forbidden": "error",
                "test/test-no-call": "error",
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
