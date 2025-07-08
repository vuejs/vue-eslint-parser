/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

import type {
    ESLintProgram,
    Token,
    VElement,
    VExpressionContainer,
} from "../src/ast"
import type TokenStore from "../src/external/token-store"
import { assert, beforeAll, describe, it } from "vitest"
import { parseForESLint as parse } from "../src"

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const PARSER_OPTIONS = {
    comment: true,
    ecmaVersion: 6,
    loc: true,
    range: true,
    tokens: true,
}

/**
 * Get the value of the given node.
 * @param token The node to get value.
 * @returns The value of the node.
 */
function toValue(token: Token): string {
    if (token.type === "HTMLAssociation") {
        return "="
    }
    if (token.type === "HTMLTagClose") {
        return ">"
    }
    return token.value
}

//------------------------------------------------------------------------------
// Main
//------------------------------------------------------------------------------

describe("services.getTemplateBodyTokenStore", () => {
    const code = `<template>
    <!--comment1-->
    <div a="b" v-show="c &lt; 3 &amp;&amp; ok == &quot;ok&quot;"><!--comment2-->{{ message /*comment3*/ }}<!--comment4--></div>
</template>`
    let ast: ESLintProgram | null = null
    let tokens: TokenStore | null = null

    beforeAll(() => {
        const result = parse(code, { filePath: "test.vue", ...PARSER_OPTIONS })
        ast = result.ast
        tokens = result.services!.getTemplateBodyTokenStore()
    })

    describe("ast.templateBody", () => {
        it("should return all tokens (except comments) in the template.", () => {
            const actual = tokens!.getTokens(ast!.templateBody!).map(toValue)

            assert.deepStrictEqual(actual, [
                "template",
                ">",
                "\n    ",
                "\n    ",
                "div",
                "a",
                "=",
                "b",
                "v-show",
                "=",
                '"',
                "c",
                "<",
                "3",
                "&&",
                "ok",
                "==",
                '"ok"',
                '"',
                ">",
                "{{",
                "message",
                "}}",
                "div",
                ">",
                "\n",
                "template",
                ">",
            ])
        })

        it("should return all tokens (include comments) in the template if you give {includeComments: true} option.", () => {
            const actual = tokens!
                .getTokens(ast!.templateBody!, { includeComments: true })
                .map(toValue)

            assert.deepStrictEqual(actual, [
                "template",
                ">",
                "\n    ",
                "comment1",
                "\n    ",
                "div",
                "a",
                "=",
                "b",
                "v-show",
                "=",
                '"',
                "c",
                "<",
                "3",
                "&&",
                "ok",
                "==",
                '"ok"',
                '"',
                ">",
                "comment2",
                "{{",
                "message",
                "comment3",
                "}}",
                "comment4",
                "div",
                ">",
                "\n",
                "template",
                ">",
            ])
        })
    })

    describe("ast.templateBody.children[0] (VText)", () => {
        it("should return a text token.", () => {
            const node = ast!.templateBody!.children[0]
            const actual = tokens!.getTokens(node).map(toValue)

            assert.deepStrictEqual(actual, ["\n    "])
        })
    })

    describe("ast.templateBody.children[2] (VElement)", () => {
        it("should return all tokens in the element.", () => {
            const node = ast!.templateBody!.children[2]
            const actual = tokens!.getTokens(node).map(toValue)

            assert.deepStrictEqual(actual, [
                "div",
                "a",
                "=",
                "b",
                "v-show",
                "=",
                '"',
                "c",
                "<",
                "3",
                "&&",
                "ok",
                "==",
                '"ok"',
                '"',
                ">",
                "{{",
                "message",
                "}}",
                "div",
                ">",
            ])
        })
    })

    describe("ast.templateBody.children[2].startTag (VStartTag)", () => {
        it("should return all tokens in the tag.", () => {
            const node = (ast!.templateBody!.children[2] as VElement).startTag
            const actual = tokens!.getTokens(node).map(toValue)

            assert.deepStrictEqual(actual, [
                "div",
                "a",
                "=",
                "b",
                "v-show",
                "=",
                '"',
                "c",
                "<",
                "3",
                "&&",
                "ok",
                "==",
                '"ok"',
                '"',
                ">",
            ])
        })
    })

    describe("ast.templateBody.children[2].startTag.attributes[0] (VAttribute)", () => {
        it("should return all tokens in the attribute.", () => {
            const node = (ast!.templateBody!.children[2] as VElement).startTag
                .attributes[0]
            const actual = tokens!.getTokens(node).map(toValue)

            assert.deepStrictEqual(actual, ["a", "=", "b"])
        })
    })

    describe("ast.templateBody.children[2].startTag.attributes[0].key (VIdentifier)", () => {
        it("should return the identifier token.", () => {
            const node = (ast!.templateBody!.children[2] as VElement).startTag
                .attributes[0].key
            const actual = tokens!.getTokens(node).map(toValue)

            assert.deepStrictEqual(actual, ["a"])
        })
    })

    describe("ast.templateBody.children[2].startTag.attributes[0].value (VAttributeValue)", () => {
        it("should return the value token.", () => {
            const node = (ast!.templateBody!.children[2] as VElement).startTag
                .attributes[0].value!
            const actual = tokens!.getTokens(node).map(toValue)

            assert.deepStrictEqual(actual, ["b"])
        })
    })

    describe("ast.templateBody.children[2].startTag.attributes[1].key (VDirectiveKey)", () => {
        it("should return the identifier token.", () => {
            const node = (ast!.templateBody!.children[2] as VElement).startTag
                .attributes[1].key
            const actual = tokens!.getTokens(node).map(toValue)

            assert.deepStrictEqual(actual, ["v-show"])
        })
    })

    describe("ast.templateBody.children[2].startTag.attributes[1].value (VExpressionContainer)", () => {
        it("should return all tokens in the value.", () => {
            const node = (ast!.templateBody!.children[2] as VElement).startTag
                .attributes[1].value!
            const actual = tokens!.getTokens(node).map(toValue)

            assert.deepStrictEqual(actual, [
                '"',
                "c",
                "<",
                "3",
                "&&",
                "ok",
                "==",
                '"ok"',
                '"',
            ])
        })
    })

    describe("ast.templateBody.children[2].startTag.attributes[1].value.expression (BinaryExpression)", () => {
        it("should return all tokens in the expression.", () => {
            const node = (
                (ast!.templateBody!.children[2] as VElement).startTag
                    .attributes[1].value as VExpressionContainer
            ).expression!
            const actual = tokens!.getTokens(node).map(toValue)

            assert.deepStrictEqual(actual, [
                "c",
                "<",
                "3",
                "&&",
                "ok",
                "==",
                '"ok"',
            ])
        })
    })

    describe("ast.templateBody.children[2].endTag (VEndTag)", () => {
        it("should return all tokens in the tag.", () => {
            const node = (ast!.templateBody!.children[2] as VElement).endTag!
            const actual = tokens!.getTokens(node).map(toValue)

            assert.deepStrictEqual(actual, ["div", ">"])
        })
    })

    describe("TokenStore#get{Range,Loc}()", () => {
        it("should return loc and range.", () => {
            const {
                children: [node],
                tokens: [token],
            } = ast!.templateBody!
            assert.equal(typeof tokens!.getRange(node)[0], "number")
            assert.equal(typeof tokens!.getRange(token)[1], "number")
            assert.equal(typeof tokens!.getLoc(node).start.line, "number")
            assert.equal(typeof tokens!.getLoc(node).end.column, "number")
        })
    })
})
