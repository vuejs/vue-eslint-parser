/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const assert = require("assert")
const parse = require("..").parse

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

//------------------------------------------------------------------------------
// Main
//------------------------------------------------------------------------------

describe("[references] expression containers", () => {
    describe("in directives", () => {
        const code = "<template><div v-foo=\"a + b\"></div></template>"
        let ast = null

        before(() => {
            ast = parse(code, Object.assign({filePath: "test.vue"}, PARSER_OPTIONS)).ast
        })

        it("should have references", () => {
            const directive = ast.templateBody.children[0].startTag.attributes[0]

            assert(directive.key.type === "VDirectiveKey")
            assert(directive.value.references != null)
            assert(directive.value.references[0].id === directive.value.expression.left)
            assert(directive.value.references[1].id === directive.value.expression.right)
        })
    })

    describe("in text", () => {
        const code = "<template>{{a + b}}</template>"
        let ast = null

        before(() => {
            ast = parse(code, Object.assign({filePath: "test.vue"}, PARSER_OPTIONS)).ast
        })

        it("should have references", () => {
            const container = ast.templateBody.children[0]

            assert(container.type === "VExpressionContainer")
            assert(container.references != null)
            assert(container.references[0].id === container.expression.left)
            assert(container.references[1].id === container.expression.right)
        })
    })

    describe("in v-on directive", () => {
        const code = "<template><div @foo=\"foo($event)\"></div></template>"
        let ast = null

        before(() => {
            ast = parse(code, Object.assign({filePath: "test.vue"}, PARSER_OPTIONS)).ast
        })

        it("should not include $event references.", () => {
            const directive = ast.templateBody.children[0].startTag.attributes[0]

            assert(directive.key.type === "VDirectiveKey")
            assert(directive.key.name === "on")
            assert(directive.value.references.length === 1)
            assert(directive.value.references[0].id === directive.value.expression.callee)
        })
    })
})

describe("[variables] elements", () => {
    describe("which have v-for directive", () => {
        const code = "<template><div v-for=\"a in b\"></div></template>"
        let ast = null

        before(() => {
            ast = parse(code, Object.assign({filePath: "test.vue"}, PARSER_OPTIONS)).ast
        })

        it("should have references", () => {
            const element = ast.templateBody.children[0]
            const directive = element.startTag.attributes[0]

            assert(element.type === "VElement")
            assert(element.variables.length === 1)
            assert(element.variables[0].id === directive.value.expression.left)
            assert(directive.value.references.length === 1)
            assert(directive.value.references[0].id === directive.value.expression.right)
        })
    })

    describe("which have v-for directive (with index)", () => {
        const code = "<template><div v-for=\"(a, i) in b\"></div></template>"
        let ast = null

        before(() => {
            ast = parse(code, Object.assign({filePath: "test.vue"}, PARSER_OPTIONS)).ast
        })

        it("should have references", () => {
            const element = ast.templateBody.children[0]
            const directive = element.startTag.attributes[0]

            assert(element.type === "VElement")
            assert(element.variables.length === 2)
            assert(element.variables[0].id === directive.value.expression.left.expressions[0])
            assert(element.variables[1].id === directive.value.expression.left.expressions[1])
            assert(directive.value.references.length === 1)
            assert(directive.value.references[0].id === directive.value.expression.right)
        })
    })

    describe("which have scope attribute", () => {
        const code = "<template><template scope=\"a\"></template></template>"
        let ast = null

        before(() => {
            ast = parse(code, Object.assign({filePath: "test.vue"}, PARSER_OPTIONS)).ast
        })

        it("should have references", () => {
            const element = ast.templateBody.children[0]
            const attribute = element.startTag.attributes[0]

            assert(element.type === "VElement")
            assert(element.variables.length === 1)
            assert(element.variables[0].id === attribute.value.expression)
            assert(attribute.value.references.length === 0)
        })
    })
})
