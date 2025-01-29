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
const jsonParser = require("jsonc-eslint-parser")
const espree = require("espree")

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------
const Linter = eslint.Linter

const parser = require("../src/index.ts")

const noNumberLiteralRule = {
    create(context) {
        let count = 0
        return {
            JSONLiteral(node) {
                if (typeof node.value === "number") {
                    context.report({
                        node,
                        message: `OK ${node.value}@count:${++count}`,
                    })
                }
            },
        }
    },
}
const noNoForbiddenKeyRule = {
    create(context) {
        return {
            'JSONProperty > JSONLiteral[value="forbidden"]'(node) {
                if (node.parent.key === node) {
                    context.report({
                        node,
                        message: 'no "forbidden" key',
                    })
                }
            },
        }
    },
}
const noParsingErrorRule = {
    create(context) {
        const parseError = context.getSourceCode().parserServices.parseError
        if (parseError) {
            let loc = undefined
            if ("column" in parseError && "lineNumber" in parseError) {
                loc = {
                    line: parseError.lineNumber,
                    column: parseError.column,
                }
            }
            return {
                Program(node) {
                    context.report({
                        node,
                        loc,
                        message: parseError.message,
                    })
                },
            }
        }
        return {}
    },
}
const noParsingErrorRule2 = {
    create(context) {
        const parseError = context.parserServices.parseError
        if (parseError) {
            let loc = undefined
            if ("column" in parseError && "lineNumber" in parseError) {
                loc = {
                    line: parseError.lineNumber,
                    column: parseError.column,
                }
            }
            return {
                Program(node) {
                    context.report({
                        node,
                        loc,
                        message: parseError.message,
                    })
                },
            }
        }
        return {}
    },
}
const noProgramExitRule = {
    create(context) {
        return {
            "Program:exit"(node) {
                context.report({
                    node,
                    message: "Program:exit",
                })
            },
        }
    },
}
const siblingSelectorRule = {
    create(context) {
        return {
            "* ~ *"(node) {
                context.report({
                    node,
                    message: "* ~ *",
                })
            },
        }
    },
}

function getConfig(target = "json") {
    const spaceUnaryOps =
        require("eslint/use-at-your-own-risk").builtinRules.get(
            "space-unary-ops",
        )
    const noParamReassign =
        require("eslint/use-at-your-own-risk").builtinRules.get(
            "no-param-reassign",
        )
    const noUnusedVars =
        require("eslint/use-at-your-own-risk").builtinRules.get(
            "no-unused-vars",
        )

    return {
        files: ["**"],
        plugins: {
            test: {
                rules: {
                    "test-no-number-literal": {
                        create: (context) =>
                            context.sourceCode.parserServices.defineCustomBlocksVisitor(
                                context,
                                jsonParser,
                                {
                                    target,
                                    ...noNumberLiteralRule,
                                },
                            ),
                    },
                    "test-no-forbidden-key": {
                        create: (context) =>
                            context.sourceCode.parserServices.defineCustomBlocksVisitor(
                                context,
                                jsonParser,
                                {
                                    target,
                                    ...noNoForbiddenKeyRule,
                                },
                            ),
                    },
                    "test-no-parsing-error": {
                        create: (context) =>
                            context.sourceCode.parserServices.defineCustomBlocksVisitor(
                                context,
                                jsonParser,
                                {
                                    target,
                                    ...noParsingErrorRule,
                                },
                            ),
                    },
                    "test-no-parsing-error2": {
                        create: (context) =>
                            context.sourceCode.parserServices.defineCustomBlocksVisitor(
                                context,
                                jsonParser,
                                {
                                    target,
                                    ...noParsingErrorRule2,
                                },
                            ),
                    },
                    "test-no-program-exit": {
                        create: (context) =>
                            context.sourceCode.parserServices.defineCustomBlocksVisitor(
                                context,
                                jsonParser,
                                {
                                    target,
                                    ...noProgramExitRule,
                                },
                                noProgramExitRule.create(context),
                            ),
                    },
                    "test-no-yml-parsing-error": {
                        create: (context) =>
                            context.sourceCode.parserServices.defineCustomBlocksVisitor(
                                context,
                                {
                                    parse() {
                                        throw new Error("Foo")
                                    },
                                },
                                {
                                    target: "yaml",
                                    ...noParsingErrorRule,
                                },
                            ),
                    },

                    "test-for-sibling-selector": {
                        create: (context) =>
                            context.sourceCode.parserServices.defineCustomBlocksVisitor(
                                context,
                                jsonParser,
                                {
                                    target: "json",
                                    create: siblingSelectorRule.create,
                                },
                            ),
                    },
                    "test-for-parse-custom-block-element": {
                        create: (context) =>
                            context.sourceCode.parserServices.defineCustomBlocksVisitor(
                                context,
                                jsonParser,
                                {
                                    target: "json",
                                    create(ctx) {
                                        return {
                                            Program(node) {
                                                const error =
                                                    ctx.sourceCode.parserServices.parseCustomBlockElement(
                                                        jsonParser,
                                                        { jsonSyntax: "json" },
                                                    ).error
                                                ctx.report({
                                                    node,
                                                    message: JSON.stringify({
                                                        lineNumber:
                                                            error.lineNumber,
                                                        column: error.column,
                                                        message: error.message,
                                                    }),
                                                })
                                            },
                                        }
                                    },
                                },
                            ),
                    },
                    "test-mark-vars": {
                        create(context) {
                            return context.sourceCode.parserServices.defineCustomBlocksVisitor(
                                context,
                                espree,
                                {
                                    target: "js",
                                    create(customBlockContext) {
                                        return {
                                            Literal() {
                                                customBlockContext.markVariableAsUsed(
                                                    "a",
                                                )
                                                customBlockContext.markVariableAsUsed(
                                                    "b",
                                                )
                                            },
                                        }
                                    },
                                },
                            )
                        },
                    },

                    "test-space-unary-ops": {
                        ...spaceUnaryOps,
                        create(context) {
                            return context.sourceCode.parserServices.defineCustomBlocksVisitor(
                                context,
                                espree,
                                {
                                    target: "js",
                                    create(customBlockContext) {
                                        return spaceUnaryOps.create(
                                            customBlockContext,
                                        )
                                    },
                                },
                            )
                        },
                    },
                    "test-no-param-reassign": {
                        ...noParamReassign,
                        create(context) {
                            return context.sourceCode.parserServices.defineCustomBlocksVisitor(
                                context,
                                espree,
                                {
                                    target: "js",
                                    create(customBlockContext) {
                                        return noParamReassign.create(
                                            customBlockContext,
                                        )
                                    },
                                },
                            )
                        },
                    },
                    "test-no-unused-vars": {
                        ...noUnusedVars,
                        create(context) {
                            return context.sourceCode.parserServices.defineCustomBlocksVisitor(
                                context,
                                espree,
                                {
                                    target: "js",
                                    create(customBlockContext) {
                                        return noUnusedVars.create(
                                            customBlockContext,
                                        )
                                    },
                                },
                            )
                        },
                    },
                },
            },
        },
        languageOptions: {
            parser,
        },
        rules: {
            "test/test-no-number-literal": "error",
            "test/test-no-forbidden-key": "error",
            "test/test-no-parsing-error": "error",
            "test/test-no-parsing-error2": "error",
        },
    }
}

function createLinter() {
    const linter = new Linter({ configType: "flat" })

    return linter
}

//------------------------------------------------------------------------------
// Tests
//------------------------------------------------------------------------------

describe("parserServices.defineCustomBlocksVisitor tests", () => {
    it("should work even if AST object was reused.", () => {
        const code = `
<i18n lang="json">
{"forbidden": 42}
</i18n>`

        const linter = createLinter()
        const messages1 = linter.verify(code, getConfig())
        const messages2 = linter.verify(linter.getSourceCode(), getConfig())

        assert.strictEqual(messages1.length, 2)
        assert.strictEqual(messages1[0].message, 'no "forbidden" key')
        assert.strictEqual(messages1[1].message, "OK 42@count:1")
        assert.strictEqual(messages1[1].line, 3)
        assert.strictEqual(messages1[1].column, 15)
        assert.strictEqual(messages1[1].endColumn, 17)
        assert.strictEqual(messages2.length, 2)
        assert.strictEqual(messages2[0].message, 'no "forbidden" key')
        assert.strictEqual(messages2[1].message, "OK 42@count:1")
    })

    it("should work even if multiple blocks.", () => {
        const code = `
<i18n lang="json">
{"foo": 42}
</i18n>
<i18n lang="json5">
{"foo": 123}
</i18n>
`
        const linter = createLinter()

        const messages = linter.verify(code, getConfig(["json", "json5"]))

        assert.strictEqual(messages.length, 2)
        assert.strictEqual(messages[0].message, "OK 42@count:1")
        assert.strictEqual(messages[0].line, 3)
        assert.strictEqual(messages[0].column, 9)
        assert.strictEqual(messages[0].endColumn, 11)
        assert.strictEqual(messages[1].message, "OK 123@count:1")
        assert.strictEqual(messages[1].line, 6)
        assert.strictEqual(messages[1].column, 9)
        assert.strictEqual(messages[1].endColumn, 12)
    })

    it("should ignore standard blocks.", () => {
        const code = `
<template lang="json">
{"foo": 42}
</template>
<style lang="json">
{"foo": 123}
</style>
`
        const linter = createLinter()

        const messages = linter.verify(code, getConfig())

        assert.strictEqual(messages.length, 0)
    })

    it("should ignore linked blocks.", () => {
        const code = `
<i18n lang="json" src="./foo.json">
{"foo": 42}
</i18n>
`
        const linter = createLinter()

        const messages = linter.verify(code, getConfig())

        assert.strictEqual(messages.length, 0)
    })
    it("should ignore un closed blocks.", () => {
        const code = `
<i18n lang="json">
{"foo": 42}
`
        const linter = createLinter()

        const messages = linter.verify(code, getConfig())

        assert.strictEqual(messages.length, 0)
    })

    it("should ignore not target blocks.", () => {
        const code = `
<i18n lang="yaml">
"foo": 42
</i18n>
<i18n lang="yml">
"foo": 42
</i18n>
<docs>
"foo": 42
</docs>
`
        const linter = createLinter()
        const config = getConfig(
            (lang, block) =>
                (lang === "json" && lang === "json5") ||
                (!lang && block.name === "i18n"),
        )

        const messages1 = linter.verify(code, config)

        assert.strictEqual(messages1.length, 0)
        const messages2 = linter.verify(`${code}<i18n>123</i18n>`, config)

        assert.strictEqual(messages2.length, 1)
    })

    it("should ignore html.", () => {
        const code = `
<i18n lang="json">
{ "foo": 42 }
</i18n>
`
        const linter = createLinter()

        const messages = linter.verify(code, getConfig(), "test.html")

        assert.strictEqual(messages.length, 0)
    })

    it("should work even if parse error.", () => {
        const code = `
<i18n lang="json">
"foo": 42
</i18n>
<i18n lang="json"></i18n>
<i18n lang="json">
</i18n>
`
        const linter = createLinter()

        const messages = linter.verify(code, getConfig())

        assert.strictEqual(messages.length, 6)
        assert.strictEqual(messages[0].message, "Unexpected token ':'.")
        assert.strictEqual(messages[0].line, 3)
        assert.strictEqual(messages[0].column, 6)
        assert.strictEqual(messages[1].message, "Unexpected token ':'.")
        assert.strictEqual(messages[1].line, 3)
        assert.strictEqual(messages[1].column, 6)
        assert.strictEqual(
            messages[2].message,
            "Expected to be an expression, but got empty.",
        )
        assert.strictEqual(messages[2].line, 5)
        assert.strictEqual(messages[2].column, 19)
        assert.strictEqual(
            messages[3].message,
            "Expected to be an expression, but got empty.",
        )
        assert.strictEqual(messages[3].line, 5)
        assert.strictEqual(messages[3].column, 19)
        assert.strictEqual(
            messages[4].message,
            "Expected to be an expression, but got empty.",
        )
        assert.strictEqual(messages[4].line, 6)
        assert.strictEqual(messages[4].column, 19)
        assert.strictEqual(
            messages[5].message,
            "Expected to be an expression, but got empty.",
        )
        assert.strictEqual(messages[5].line, 6)
        assert.strictEqual(messages[5].column, 19)
    })

    it("should work even if error.", () => {
        const code = `
<i18n lang="json">
{ "foo": 42 }
</i18n>
<i18n lang="yaml">
"foo" 42
</i18n>
`
        const linter = createLinter()
        const baseConfig = getConfig()

        const messages = linter.verify(code, {
            ...baseConfig,
            rules: {
                ...baseConfig.rules,
                "test/test-no-yml-parsing-error": "error",
            },
        })

        assert.strictEqual(messages.length, 2)
        assert.strictEqual(messages[0].message, "OK 42@count:1")
        assert.strictEqual(messages[0].line, 3)
        assert.strictEqual(messages[0].column, 10)
        assert.strictEqual(messages[0].endColumn, 12)
        assert.strictEqual(messages[1].message, "Foo")
        assert.strictEqual(messages[1].line, 5)
        assert.strictEqual(messages[1].column, 19)
    })
    it("should work even with scriptVisitor.", () => {
        const code = `
<i18n lang="json">
{ "foo": 42 }
</i18n>
`
        const linter = createLinter()
        const baseConfig = getConfig()

        const messages = linter.verify(code, {
            ...baseConfig,
            rules: {
                "test/test-no-program-exit": "error",
                ...baseConfig.rules,
            },
        })

        assert.strictEqual(messages.length, 3)
        assert.strictEqual(messages[0].message, "Program:exit")
        assert.strictEqual(messages[0].line, 1)
        assert.strictEqual(messages[0].column, 1)
        assert.strictEqual(messages[1].message, "Program:exit")
        assert.strictEqual(messages[1].line, 2)
        assert.strictEqual(messages[1].column, 19)
        assert.strictEqual(messages[2].message, "OK 42@count:1")
    })
    it("should work with parseCustomBlockElement().", () => {
        const code = `
<i18n lang="json">
{ "foo": "bar" }// comment
</i18n>
`
        const linter = createLinter()
        const baseConfig = getConfig()

        const messages = linter.verify(code, {
            ...baseConfig,
            rules: {
                "test/test-for-parse-custom-block-element": "error",
                ...baseConfig.rules,
            },
        })

        assert.strictEqual(messages.length, 1)
        assert.strictEqual(
            messages[0].message,
            '{"lineNumber":3,"column":16,"message":"Unexpected comment."}',
        )
    })

    it("should work even if used sibling selector.", () => {
        const code = `
<i18n lang="json">
[42, 42]
</i18n>
`
        const linter = createLinter()
        const baseConfig = getConfig()

        const messages = linter.verify(code, {
            ...baseConfig,
            rules: {
                "test/test-for-sibling-selector": "error",
            },
        })

        assert.strictEqual(messages.length, 1)
        assert.strictEqual(messages[0].message, "* ~ *")
        assert.strictEqual(messages[0].line, 3)
        assert.strictEqual(messages[0].column, 6)
    })

    describe("API tests", () => {
        it("should work getAncestors().", () => {
            const code = `
<i18n lang="json">
{ "foo": { "bar": "target" } }
</i18n>
`
            const linter = createLinter()
            const baseConfig = getConfig()

            const plugin = {
                rules: {
                    test: {
                        create: (context) =>
                            context.sourceCode.parserServices.defineCustomBlocksVisitor(
                                context,
                                jsonParser,
                                {
                                    target: "json",
                                    create(customBlockContext) {
                                        return {
                                            "JSONLiteral[value='target']"(
                                                node,
                                            ) {
                                                customBlockContext.report({
                                                    node,
                                                    message: JSON.stringify(
                                                        customBlockContext
                                                            .getAncestors()
                                                            .map((n) => n.type),
                                                    ),
                                                })
                                            },
                                        }
                                    },
                                },
                            ),
                    },
                },
            }

            const messages = linter.verify(code, [
                baseConfig,
                {
                    files: ["**"],
                    plugins: {
                        t: plugin,
                    },
                    rules: {
                        "t/test": "error",
                    },
                },
            ])

            assert.strictEqual(messages.length, 1)
            assert.strictEqual(
                messages[0].message,
                '["Program","JSONExpressionStatement","JSONObjectExpression","JSONProperty","JSONObjectExpression","JSONProperty"]',
            )
        })
        it("should work getSourceCode().", () => {
            const code = `
<i18n lang="json">
{ "foo": { "bar": "target" } }
</i18n>
`
            const linter = createLinter()
            const baseConfig = getConfig()

            const plugin = {
                rules: {
                    test: {
                        create: (context) =>
                            context.sourceCode.parserServices.defineCustomBlocksVisitor(
                                context,
                                jsonParser,
                                {
                                    target: "json",
                                    create(customBlockContext) {
                                        return {
                                            "JSONLiteral[value='target']"(
                                                node,
                                            ) {
                                                customBlockContext.report({
                                                    node,
                                                    message: JSON.stringify(
                                                        customBlockContext
                                                            .getSourceCode()
                                                            .getLocFromIndex(
                                                                node.range[0],
                                                            ),
                                                    ),
                                                })
                                            },
                                        }
                                    },
                                },
                            ),
                    },
                },
            }

            const messages = linter.verify(code, [
                baseConfig,
                {
                    files: ["**"],
                    plugins: {
                        t: plugin,
                    },
                    rules: {
                        "t/test": "error",
                    },
                },
            ])

            assert.strictEqual(messages.length, 1)
            assert.strictEqual(messages[0].message, '{"line":3,"column":18}')
            assert.strictEqual(messages[0].line, 3)
            assert.strictEqual(messages[0].column, 19)
        })

        it("should work markVariableAsUsed().", () => {
            const code = `
<js lang="js">
let a = 42;
</js>
`
            const linter = createLinter()
            const baseConfig = getConfig()

            const messages1 = linter.verify(code, {
                ...baseConfig,
                rules: {
                    ...baseConfig.rules,
                    "test/test-no-unused-vars": "error",
                },
            })

            assert.strictEqual(messages1.length, 1)
            assert.strictEqual(
                messages1[0].message,
                "'a' is assigned a value but never used.",
            )

            const messages2 = linter.verify(code, {
                ...baseConfig,
                rules: {
                    ...baseConfig.rules,
                    "test/test-no-unused-vars": "error",
                    "test/test-mark-vars": "error",
                },
            })

            assert.strictEqual(messages2.length, 0)
        })

        it("should work getDeclaredVariables().", () => {
            const code = `
<js lang="js">
function a(arg) {
    arg = 42
}
</js>
`
            const linter = createLinter()
            const baseConfig = getConfig()

            const messages1 = linter.verify(code, {
                ...baseConfig,
                rules: {
                    ...baseConfig.rules,
                    "test/test-no-param-reassign": "error",
                },
            })

            assert.strictEqual(messages1.length, 1)
            assert.strictEqual(
                messages1[0].message,
                "Assignment to function parameter 'arg'.",
            )
        })

        it("should work sourceCode.", () => {
            const code = `
<js lang="js">
var v = + 42
</js>
`
            const linter = createLinter()
            const baseConfig = getConfig()

            const messages1 = linter.verify(code, {
                ...baseConfig,
                rules: {
                    ...baseConfig.rules,
                    "test/test-space-unary-ops": "error",
                },
            })

            assert.strictEqual(messages1.length, 1)
            assert.strictEqual(
                messages1[0].message,
                "Unexpected space after unary operator '+'.",
            )
        })
    })
})
