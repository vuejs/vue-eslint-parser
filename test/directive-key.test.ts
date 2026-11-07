import { describe, it, assert } from "vitest"
import { parseForESLint } from "../src"
import type { VAttribute, VDirective } from "../src/ast"

function getFirstDirective(code: string): VDirective {
    const result = parseForESLint(code, {
        filePath: "test.vue",
        ecmaVersion: "latest",
        sourceType: "module",
    })
    assert.deepStrictEqual(result.ast.templateBody?.errors, [])

    const queue = [...(result.ast.templateBody?.children ?? [])]
    while (queue.length > 0) {
        const node = queue.shift()!
        if (node.type === "VElement") {
            const directive = node.startTag.attributes.find(
                (attr: VAttribute): attr is VDirective => attr.directive,
            )
            if (directive) {
                return directive
            }
            queue.push(...node.children)
        }
    }

    throw new Error("Expected to find a directive.")
}

describe("directive key", () => {
    it("parses dots in static v-slot arguments as part of the slot name", () => {
        const directive = getFirstDirective(
            '<template><Foobar><template v-slot:head(foo.bar).baz="props"></template></Foobar></template>',
        )

        assert.strictEqual(directive.key.name.name, "slot")
        assert.strictEqual(directive.key.argument?.type, "VIdentifier")
        assert.strictEqual(directive.key.argument.rawName, "head(foo.bar).baz")
        assert.deepStrictEqual(directive.key.modifiers, [])
    })

    it("parses dots in v-slot shorthand arguments as part of the slot name", () => {
        const directive = getFirstDirective(
            '<template><Foobar><template #head.foo="props"></template></Foobar></template>',
        )

        assert.strictEqual(directive.key.name.name, "slot")
        assert.strictEqual(directive.key.argument?.type, "VIdentifier")
        assert.strictEqual(directive.key.argument.rawName, "head.foo")
        assert.deepStrictEqual(directive.key.modifiers, [])
    })

    it("preserves modifiers on non-slot directive keys", () => {
        const vOn = getFirstDirective(
            '<template><button v-on:click.stop="handler"></button></template>',
        )
        assert.strictEqual(vOn.key.argument?.type, "VIdentifier")
        assert.strictEqual(vOn.key.argument.rawName, "click")
        assert.deepStrictEqual(
            vOn.key.modifiers.map((modifier) => modifier.rawName),
            ["stop"],
        )

        const vBind = getFirstDirective(
            '<template><button v-bind:foo.bar="value"></button></template>',
        )
        assert.strictEqual(vBind.key.argument?.type, "VIdentifier")
        assert.strictEqual(vBind.key.argument.rawName, "foo")
        assert.deepStrictEqual(
            vBind.key.modifiers.map((modifier) => modifier.rawName),
            ["bar"],
        )
    })
})
