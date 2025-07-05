/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

import type {
    ESLintBinaryExpression,
    ESLintCallExpression,
    ESLintExpressionStatement,
    ESLintProgram,
    Reference,
    Variable,
    VDirective,
    VElement,
    VExpressionContainer,
    VForExpression,
    VOnExpression,
} from "../src/ast"
import { describe, it, assert, beforeAll } from "vitest"
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

//------------------------------------------------------------------------------
// Main
//------------------------------------------------------------------------------

describe("[references] expression containers", () => {
    describe("in directives", () => {
        const code = '<template><div v-foo="a + b"></div></template>'
        // @ts-expect-error init in beforeAll
        let ast: ESLintProgram = null

        beforeAll(() => {
            ast = parse(code, { filePath: "test.vue", ...PARSER_OPTIONS }).ast
        })

        it("should have references", () => {
            const element = ast.templateBody!.children[0] as VElement
            const directive = element.startTag.attributes[0] as VDirective

            assert(directive.key.type === "VDirectiveKey")
            assert(directive.value!.references != null)
            assert(
                directive.value!.references[0].id ===
                    (directive.value!.expression as ESLintBinaryExpression)
                        .left,
            )
            assert(
                directive.value!.references[1].id ===
                    (directive.value!.expression as ESLintBinaryExpression)
                        .right,
            )
        })
    })

    describe("in text", () => {
        const code = "<template>{{a + b}}</template>"
        // @ts-expect-error init in beforeAll
        let ast: ESLintProgram = null

        beforeAll(() => {
            ast = parse(code, { filePath: "test.vue", ...PARSER_OPTIONS }).ast
        })

        it("should have references", () => {
            const container = ast.templateBody!
                .children[0] as VExpressionContainer

            assert(container.type === "VExpressionContainer")
            assert(container.references != null)
            assert(
                container.references[0].id ===
                    (container.expression as ESLintBinaryExpression).left,
            )
            assert(
                container.references[1].id ===
                    (container.expression as ESLintBinaryExpression).right,
            )
        })
    })

    describe("in v-on directive", () => {
        const code = '<template><div @foo="foo($event)"></div></template>'
        // @ts-expect-error init in beforeAll
        let ast: ESLintProgram = null

        beforeAll(() => {
            ast = parse(code, { filePath: "test.vue", ...PARSER_OPTIONS }).ast
        })

        it("should not include $event references.", () => {
            const element = ast.templateBody!.children[0] as VElement
            const directive = element.startTag.attributes[0] as VDirective

            assert(directive.key.type === "VDirectiveKey")
            assert(directive.key.name.name === "on")
            assert(directive.value!.references.length === 1)
            assert(
                directive.value!.references[0].id ===
                    (
                        (
                            (directive.value!.expression as VOnExpression)
                                .body[0] as ESLintExpressionStatement
                        ).expression as ESLintCallExpression
                    ).callee,
            )
        })
    })
})

describe("[variables] elements", () => {
    describe("which have v-for directive", () => {
        const code = '<template><div v-for="a in b"></div></template>'
        // @ts-expect-error init in beforeAll
        let ast: ESLintProgram = null

        beforeAll(() => {
            ast = parse(code, { filePath: "test.vue", ...PARSER_OPTIONS }).ast
        })

        it("should have references", () => {
            const element = ast.templateBody!.children[0] as VElement
            const directive = element.startTag.attributes[0] as VDirective
            const vForExpression = directive.value!.expression as VForExpression

            assert(element.type === "VElement")
            assert(element.variables.length === 1)
            assert(element.variables[0].id === vForExpression.left[0])
            assert(directive.value!.references.length === 1)
            assert(directive.value!.references[0].id === vForExpression.right)
        })
    })

    describe("which have v-for directive (with index)", () => {
        const code = '<template><div v-for="(a, i) in b"></div></template>'
        // @ts-expect-error init in beforeAll
        let ast: ESLintProgram = null

        beforeAll(() => {
            ast = parse(code, { filePath: "test.vue", ...PARSER_OPTIONS }).ast
        })

        it("should have references", () => {
            const element = ast.templateBody!.children[0] as VElement
            const directive = element.startTag.attributes[0] as VDirective
            const vForExpression = directive.value!.expression as VForExpression

            assert(element.type === "VElement")
            assert(element.variables.length === 2)
            assert(element.variables[0].id === vForExpression.left[0])
            assert(element.variables[1].id === vForExpression.left[1])
            assert(directive.value!.references.length === 1)
            assert(directive.value!.references[0].id === vForExpression.right)
        })
    })

    describe("which have scope attribute", () => {
        const code = '<template><template scope="a"></template></template>'
        // @ts-expect-error init in beforeAll
        let ast: ESLintProgram = null

        beforeAll(() => {
            ast = parse(code, { filePath: "test.vue", ...PARSER_OPTIONS }).ast
        })

        it("should have variables", () => {
            const element = ast.templateBody!.children[0] as VElement
            const attribute = element.startTag.attributes[0] as VDirective

            assert(element.type === "VElement")
            assert(element.variables.length === 1)
            assert(element.variables[0].id.name === "a")
            assert(element.variables[0].id.range[0] === 27)
            assert(element.variables[0].id.range[1] === 28)
            assert(element.variables[0].kind === "scope")
            assert(attribute.value!.type === "VExpressionContainer")
            assert(attribute.value!.expression!.type === "VSlotScopeExpression")
            assert(attribute.value!.expression.params[0].type === "Identifier")
            assert(attribute.value!.expression.params[0].name === "a")
        })
    })
})

describe("Variables of v-for and references", () => {
    const code =
        '<template><div v-for="x of xs" :key="x">{{x + y}}<div>{{x}}</div></div>{{x}}</template>'
    // @ts-expect-error init in beforeAll
    let variables: Variable[] = null
    // @ts-expect-error init in beforeAll
    let vForReferences: Reference[] = null
    // @ts-expect-error init in beforeAll
    let vBindKeyReferences: Reference[] = null
    // @ts-expect-error init in beforeAll
    let mustacheReferences1: Reference[] = null
    // @ts-expect-error init in beforeAll
    let mustacheReferences2: Reference[] = null
    // @ts-expect-error init in beforeAll
    let mustacheReferences3: Reference[] = null

    beforeAll(() => {
        const ast = parse(code, { filePath: "test.vue", ...PARSER_OPTIONS }).ast
        const firstChild = ast.templateBody!.children[0] as VElement
        const secondChild = ast.templateBody!
            .children[1] as VExpressionContainer
        variables = firstChild.variables
        vForReferences = (
            firstChild.startTag.attributes[0].value as VExpressionContainer
        ).references
        vBindKeyReferences = (
            firstChild.startTag.attributes[1].value as VExpressionContainer
        ).references
        mustacheReferences1 = (firstChild.children[0] as VExpressionContainer)
            .references
        mustacheReferences2 = (
            (firstChild.children[1] as VElement)
                .children[0] as VExpressionContainer
        ).references
        mustacheReferences3 = secondChild.references
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
                Object.getOwnPropertyDescriptor(variable, "references")!
                    .enumerable === false,
            )
        }
    })

    it("`Reference#variable` should be non-enumerable", () => {
        for (const reference of ([] as Reference[]).concat(
            vForReferences,
            vBindKeyReferences,
            mustacheReferences1,
            mustacheReferences2,
            mustacheReferences3,
        )) {
            assert(
                Object.getOwnPropertyDescriptor(reference, "variable")!
                    .enumerable === false,
            )
        }
    })
})

describe("Variables of template-scope and references", () => {
    const code =
        '<template><template scope="x" :key="x">{{x + y}}<div>{{x}}</div></template>{{x}}</template>'
    // @ts-expect-error init in beforeAll
    let variables: Variable[] = null
    // @ts-expect-error init in beforeAll
    let vBindKeyReferences: Reference[] = null
    // @ts-expect-error init in beforeAll
    let mustacheReferences1: Reference[] = null
    // @ts-expect-error init in beforeAll
    let mustacheReferences2: Reference[] = null
    // @ts-expect-error init in beforeAll
    let mustacheReferences3: Reference[] = null

    beforeAll(() => {
        const ast = parse(code, { filePath: "test.vue", ...PARSER_OPTIONS }).ast
        const element = ast.templateBody!.children[0] as VElement
        const secondElement = ast.templateBody!
            .children[1] as VExpressionContainer

        variables = element.variables
        vBindKeyReferences = (element.startTag.attributes[1] as VDirective)
            .value!.references
        mustacheReferences1 = (element.children[0] as VExpressionContainer)
            .references
        mustacheReferences2 = (
            (element.children[1] as VElement)
                .children[0] as VExpressionContainer
        ).references
        mustacheReferences3 = secondElement.references
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
                Object.getOwnPropertyDescriptor(variable, "references")!
                    .enumerable === false,
            )
        }
    })

    it("`Reference#variable` should be non-enumerable", () => {
        for (const reference of ([] as Reference[]).concat(
            vBindKeyReferences,
            mustacheReferences1,
            mustacheReferences2,
            mustacheReferences3,
        )) {
            assert(
                Object.getOwnPropertyDescriptor(reference, "variable")!
                    .enumerable === false,
            )
        }
    })
})

describe("Variables of v-for and references of dynamic arguments", () => {
    const code = '<template><div v-for="x of xs" :[x]="1" /></template>'
    // @ts-expect-error init in beforeAll
    let variables: Variable[] = null
    // @ts-expect-error init in beforeAll
    let vForReferences: Reference[] = null
    // @ts-expect-error init in beforeAll
    let vBindKeyReferences: Reference[] = null

    beforeAll(() => {
        const ast = parse(code, { filePath: "test.vue", ...PARSER_OPTIONS }).ast
        const element = ast.templateBody!.children[0] as VElement

        variables = element.variables
        vForReferences = (element.startTag.attributes[0] as VDirective).value!
            .references
        vBindKeyReferences = (
            (element.startTag.attributes[1] as VDirective).key
                .argument as VExpressionContainer
        ).references
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
    // @ts-expect-error init in beforeAll
    let variables: Variable[] = null
    // @ts-expect-error init in beforeAll
    let vForReferences: Reference[] = null
    // @ts-expect-error init in beforeAll
    let vBindReferences: Reference[] = null

    beforeAll(() => {
        const ast = parse(code, { filePath: "test.vue", ...PARSER_OPTIONS }).ast
        const element = ast.templateBody!.children[0] as VElement

        variables = element.variables
        vForReferences = (element.startTag.attributes[0] as VDirective).value!
            .references
        vBindReferences = (element.startTag.attributes[1] as VDirective).value!
            .references
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
    // @ts-expect-error init in beforeAll
    let variables: Variable[] = null
    // @ts-expect-error init in beforeAll
    let vForReferences: Reference[] = null
    // @ts-expect-error init in beforeAll
    let vBindReferences: Reference[] = null

    beforeAll(() => {
        const ast = parse(code, { filePath: "test.vue", ...PARSER_OPTIONS }).ast
        const element = ast.templateBody!.children[0] as VElement

        variables = element.variables
        vForReferences = (element.startTag.attributes[0] as VDirective).value!
            .references
        vBindReferences = (element.startTag.attributes[1] as VDirective).value!
            .references
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
