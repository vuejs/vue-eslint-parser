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
const parse = require("../src").parseForESLint

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
        const code = '<template><div v-foo="a + b"></div></template>'
        let ast = null

        before(() => {
            ast = parse(
                code,
                Object.assign({ filePath: "test.vue" }, PARSER_OPTIONS),
            ).ast
        })

        it("should have references", () => {
            const directive =
                ast.templateBody.children[0].startTag.attributes[0]

            assert(directive.key.type === "VDirectiveKey")
            assert(directive.value.references != null)
            assert(
                directive.value.references[0].id ===
                    directive.value.expression.left,
            )
            assert(
                directive.value.references[1].id ===
                    directive.value.expression.right,
            )
        })
    })

    describe("in text", () => {
        const code = "<template>{{a + b}}</template>"
        let ast = null

        before(() => {
            ast = parse(
                code,
                Object.assign({ filePath: "test.vue" }, PARSER_OPTIONS),
            ).ast
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
        const code = '<template><div @foo="foo($event)"></div></template>'
        let ast = null

        before(() => {
            ast = parse(
                code,
                Object.assign({ filePath: "test.vue" }, PARSER_OPTIONS),
            ).ast
        })

        it("should not include $event references.", () => {
            const directive =
                ast.templateBody.children[0].startTag.attributes[0]

            assert(directive.key.type === "VDirectiveKey")
            assert(directive.key.name.name === "on")
            assert(directive.value.references.length === 1)
            assert(
                directive.value.references[0].id ===
                    directive.value.expression.body[0].expression.callee,
            )
        })
    })
})

describe("[variables] elements", () => {
    describe("which have v-for directive", () => {
        const code = '<template><div v-for="a in b"></div></template>'
        let ast = null

        before(() => {
            ast = parse(
                code,
                Object.assign({ filePath: "test.vue" }, PARSER_OPTIONS),
            ).ast
        })

        it("should have references", () => {
            const element = ast.templateBody.children[0]
            const directive = element.startTag.attributes[0]

            assert(element.type === "VElement")
            assert(element.variables.length === 1)
            assert(
                element.variables[0].id === directive.value.expression.left[0],
            )
            assert(directive.value.references.length === 1)
            assert(
                directive.value.references[0].id ===
                    directive.value.expression.right,
            )
        })
    })

    describe("which have v-for directive (with index)", () => {
        const code = '<template><div v-for="(a, i) in b"></div></template>'
        let ast = null

        before(() => {
            ast = parse(
                code,
                Object.assign({ filePath: "test.vue" }, PARSER_OPTIONS),
            ).ast
        })

        it("should have references", () => {
            const element = ast.templateBody.children[0]
            const directive = element.startTag.attributes[0]

            assert(element.type === "VElement")
            assert(element.variables.length === 2)
            assert(
                element.variables[0].id === directive.value.expression.left[0],
            )
            assert(
                element.variables[1].id === directive.value.expression.left[1],
            )
            assert(directive.value.references.length === 1)
            assert(
                directive.value.references[0].id ===
                    directive.value.expression.right,
            )
        })
    })

    describe("which have scope attribute", () => {
        const code = '<template><template scope="a"></template></template>'
        let ast = null

        before(() => {
            ast = parse(
                code,
                Object.assign({ filePath: "test.vue" }, PARSER_OPTIONS),
            ).ast
        })

        it("should have variables", () => {
            const element = ast.templateBody.children[0]
            const attribute = element.startTag.attributes[0]

            assert(element.type === "VElement")
            assert(element.variables.length === 1)
            assert(element.variables[0].id.name === "a")
            assert(element.variables[0].id.range[0] === 27)
            assert(element.variables[0].id.range[1] === 28)
            assert(element.variables[0].kind === "scope")
            assert(attribute.value.type === "VExpressionContainer")
            assert(attribute.value.expression.type === "VSlotScopeExpression")
            assert(attribute.value.expression.params[0].type === "Identifier")
            assert(attribute.value.expression.params[0].name === "a")
        })
    })
})

describe("Variables of v-for and references", () => {
    const code =
        '<template><div v-for="x of xs" :key="x">{{x + y}}<div>{{x}}</div></div>{{x}}</template>'
    let variables = null
    let vForReferences = null
    let vBindKeyReferences = null
    let mustacheReferences1 = null
    let mustacheReferences2 = null
    let mustacheReferences3 = null

    before(() => {
        const ast = parse(
            code,
            Object.assign({ filePath: "test.vue" }, PARSER_OPTIONS),
        ).ast
        variables = ast.templateBody.children[0].variables
        vForReferences =
            ast.templateBody.children[0].startTag.attributes[0].value.references
        vBindKeyReferences =
            ast.templateBody.children[0].startTag.attributes[1].value.references
        mustacheReferences1 =
            ast.templateBody.children[0].children[0].references
        mustacheReferences2 =
            ast.templateBody.children[0].children[1].children[0].references
        mustacheReferences3 = ast.templateBody.children[1].references
    })

    it("should have relationship each other", () => {
        assert(variables.length === 1)
        assert(vForReferences.length === 1)
        assert(vBindKeyReferences.length === 1)
        assert(mustacheReferences1.length === 2)
        assert(mustacheReferences2.length === 1)
        assert(mustacheReferences3.length === 1)
        assert(variables[0].references.length === 3)
        assert(variables[0].references[0] === vBindKeyReferences[0])
        assert(variables[0].references[1] === mustacheReferences1[0])
        assert(variables[0].references[2] === mustacheReferences2[0])
        assert(vForReferences[0].variable === null)
        assert(vBindKeyReferences[0].variable === variables[0])
        assert(mustacheReferences1[0].variable === variables[0])
        assert(mustacheReferences1[1].variable === null)
        assert(mustacheReferences2[0].variable === variables[0])
        assert(mustacheReferences3[0].variable === null)
    })

    it("`Variable#references` should be non-enumerable", () => {
        for (const variable of variables) {
            assert(
                Object.getOwnPropertyDescriptor(variable, "references")
                    .enumerable === false,
            )
        }
    })

    it("`Reference#variable` should be non-enumerable", () => {
        for (const reference of [].concat(
            vForReferences,
            vBindKeyReferences,
            mustacheReferences1,
            mustacheReferences2,
            mustacheReferences3,
        )) {
            assert(
                Object.getOwnPropertyDescriptor(reference, "variable")
                    .enumerable === false,
            )
        }
    })
})

describe("Variables of template-scope and references", () => {
    const code =
        '<template><template scope="x" :key="x">{{x + y}}<div>{{x}}</div></template>{{x}}</template>'
    let variables = null
    let vBindKeyReferences = null
    let mustacheReferences1 = null
    let mustacheReferences2 = null
    let mustacheReferences3 = null

    before(() => {
        const ast = parse(
            code,
            Object.assign({ filePath: "test.vue" }, PARSER_OPTIONS),
        ).ast
        variables = ast.templateBody.children[0].variables
        vBindKeyReferences =
            ast.templateBody.children[0].startTag.attributes[1].value.references
        mustacheReferences1 =
            ast.templateBody.children[0].children[0].references
        mustacheReferences2 =
            ast.templateBody.children[0].children[1].children[0].references
        mustacheReferences3 = ast.templateBody.children[1].references
    })

    it("should have relationship each other", () => {
        assert(variables.length === 1)
        assert(vBindKeyReferences.length === 1)
        assert(mustacheReferences1.length === 2)
        assert(mustacheReferences2.length === 1)
        assert(mustacheReferences3.length === 1)
        assert(variables[0].references.length === 3)
        assert(variables[0].references[0] === vBindKeyReferences[0])
        assert(variables[0].references[1] === mustacheReferences1[0])
        assert(variables[0].references[2] === mustacheReferences2[0])
        assert(vBindKeyReferences[0].variable === variables[0])
        assert(mustacheReferences1[0].variable === variables[0])
        assert(mustacheReferences1[1].variable === null)
        assert(mustacheReferences2[0].variable === variables[0])
        assert(mustacheReferences3[0].variable === null)
    })

    it("`Variable#references` should be non-enumerable", () => {
        for (const variable of variables) {
            assert(
                Object.getOwnPropertyDescriptor(variable, "references")
                    .enumerable === false,
            )
        }
    })

    it("`Reference#variable` should be non-enumerable", () => {
        for (const reference of [].concat(
            vBindKeyReferences,
            mustacheReferences1,
            mustacheReferences2,
            mustacheReferences3,
        )) {
            assert(
                Object.getOwnPropertyDescriptor(reference, "variable")
                    .enumerable === false,
            )
        }
    })
})

describe("Variables of v-for and references of dynamic arguments", () => {
    const code = '<template><div v-for="x of xs" :[x]="1" /></template>'
    let variables = null
    let vForReferences = null
    let vBindKeyReferences = null

    before(() => {
        const ast = parse(
            code,
            Object.assign({ filePath: "test.vue" }, PARSER_OPTIONS),
        ).ast
        variables = ast.templateBody.children[0].variables
        vForReferences =
            ast.templateBody.children[0].startTag.attributes[0].value.references
        vBindKeyReferences =
            ast.templateBody.children[0].startTag.attributes[1].key.argument
                .references
    })

    it("should have relationship each other", () => {
        assert(variables.length === 1)
        assert(vForReferences.length === 1)
        assert(vBindKeyReferences.length === 1)
        assert(variables[0].references.length === 1)
        assert(variables[0].references[0] === vBindKeyReferences[0])
        assert(vForReferences[0].variable === null)
        assert(vBindKeyReferences[0].variable === variables[0])
    })
})

describe("Variables of v-for and references of v-bind same-name shorthand", () => {
    const code = '<template><div v-for="x of xs" :x /></template>'
    let variables = null
    let vForReferences = null
    let vBindReferences = null

    before(() => {
        const ast = parse(
            code,
            Object.assign({ filePath: "test.vue" }, PARSER_OPTIONS),
        ).ast
        variables = ast.templateBody.children[0].variables
        vForReferences =
            ast.templateBody.children[0].startTag.attributes[0].value.references
        vBindReferences =
            ast.templateBody.children[0].startTag.attributes[1].value.references
    })

    it("should have relationship each other", () => {
        assert(variables.length === 1)
        assert(vForReferences.length === 1)
        assert(vBindReferences.length === 1)
        assert(variables[0].references.length === 1)
        assert(variables[0].references[0] === vBindReferences[0])
        assert(vForReferences[0].variable === null)
        assert(vBindReferences[0].variable === variables[0])
    })
})

describe("Variables of v-for and references of v-bind same-name shorthand with kebab-case", () => {
    const code = '<template><div v-for="dataXx of xs" :data-xx /></template>'
    let variables = null
    let vForReferences = null
    let vBindReferences = null

    before(() => {
        const ast = parse(
            code,
            Object.assign({ filePath: "test.vue" }, PARSER_OPTIONS),
        ).ast
        variables = ast.templateBody.children[0].variables
        vForReferences =
            ast.templateBody.children[0].startTag.attributes[0].value.references
        vBindReferences =
            ast.templateBody.children[0].startTag.attributes[1].value.references
    })

    it("should have relationship each other", () => {
        assert(variables.length === 1)
        assert(vForReferences.length === 1)
        assert(vBindReferences.length === 1)
        assert(variables[0].references.length === 1)
        assert(variables[0].references[0] === vBindReferences[0])
        assert(vForReferences[0].variable === null)
        assert(vBindReferences[0].variable === variables[0])
    })
})
