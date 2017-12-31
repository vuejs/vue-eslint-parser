# AST for `<template lang="html">`

Some types are featured from [ESTree].

- [Program]
- [Node]
- [Statement]
- [BlockStatement]
- [Expression]
- [Literal]
- [Pattern]

You can use the type definition of this AST:

```ts
import { AST } from "vue-eslint-parser"

export function create(context) {
    return context.parserServices.defineTemplateBodyVisitor(
        // Event handlers for <template>.
        {
            VElement(node: AST.VElement): void {
                //...
            }
        },
        // Event handlers for <script>. (optional)
        {
            Program(node: AST.ESLintProgram): void {
                //...
            }
        }
    )
}
```

`AST` has the types of ESLint's AST with the prefix `ESLint`.<br>
See details: [../src/ast/nodes.ts](../src/ast/nodes.ts)

## Node

```js
extend interface Node {
    range: [ number ]
}
```

- This AST spec enhances the [Node] nodes like ESLint.
- The `range` property is an array which has 2 integers.
  The 1st integer is the offset of the start location of the node.
  The 2nd integer is the offset of the end location of the node.

## VIdentifier

```js
interface VIdentifier <: Node {
    type: "VIdentifier"
    name: string
}
```

- This is similar to [Identifier] nodes but this `name` property can include any
  characters except U+0000-U+001F, U+007F-U+009F, U+0020, U+0022, U+0027, U+003E,
  U+002F, U+003D, U+FDD0-U+FDEF, U+FFFE, U+FFFF, U+1FFFE, U+1FFFF, U+2FFFE, U+2FFFF,
  U+3FFFE, U+3FFFF, U+4FFFE, U+4FFFF, U+5FFFE, U+5FFFF, U+6FFFE, U+6FFFF, U+7FFFE,
  U+7FFFF, U+8FFFE, U+8FFFF, U+9FFFE, U+9FFFF, U+AFFFE, U+AFFFF, U+BFFFE, U+BFFFF,
  U+CFFFE, U+CFFFF, U+DFFFE, U+DFFFF, U+EFFFE, U+EFFFF, U+FFFFE, U+FFFFF, U+10FFFE
  and U+10FFFF.
- This is attribute names.

## VText

```js
interface VText <: Node {
    type: "VText"
    value: string
}
```

- Plain text of HTML.
- HTML entities in the `value` property are decoded.

## VExpressionContainer

```js
interface VExpressionContainer <: Node {
    type: "VExpressionContainer"
    expression: Expression | null
    references: [ Reference ]
}

interface Reference {
    id: Identifier
    mode: "rw" | "r" | "w"
    variable: Variable | null
}

interface VForExpression <: Expression {
    type: "VForExpression"
    left: [ Pattern ]
    right: Expression
}

interface VOnExpression <: Expression {
    type: "VOnExpression"
    body: [ Statement ]
}
```

- This is mustaches or directive values.
- If syntax errors exist, `VExpressionContainer#expression` is `null`.
- `Reference` is objects but not `Node`. Those are external references which are in the expression.
- `Reference#variable` is the variable which is defined by a `VElement`. If a reference uses a global variable or a member of VM, this is `null`.
- `VForExpression` is an expression node like [ForInStatement] but it has an array as `left` property and does not have `body` property. This is the value of [`v-for` directives].
- `VOnExpression` is an expression node like [BlockStatement] but it does not have braces. This is the value of [`v-on` directives].

> Note: `vue-eslint-parser` transforms `v-for="(x, i) in list"` to `for(let [x, i] in list);` then gives the configured parser (`espree` by default) it. This implies that it needs the capability to parse ES2015 destructuring in order to parse [`v-for` directives].

## VDirectiveKey

```js
interface VDirectiveKey <: Node {
    type: "VDirectiveKey"
    name: string
    argument: string | null
    modifiers: [ string ]
    shorthand: boolean
}
```

- The `name` property doesn't have `v-` prefix. It's dropped.
- In the shorthand of `v-bind` cases, the `name` property is `"bind"` and the `shorthand` property is `true`.
- In the shorthand of `v-on` cases, the `name` property is `"on"` and the `shorthand` property is `true`.
- Otherwise, `shorthand` property is always `false`.

## VLiteral

```js
interface VLiteral <: Node {
    type: "VAttributeValue"
    value: string
}
```

- This is similar to [Literal] nodes but this is not always quoted.
- HTML entities in the `value` property are decoded.

## VAttribute

```js
interface VAttribute <: Node {
    type: "VAttribute"
    directive: false
    key: VIdentifier
    value: VLiteral | null
}

interface VDirective <: Node {
    type: "VAttribute"
    directive: true
    key: VDirectiveKey
    value: VExpressionContainer | null
}
```

- If their attribute value does not exist, the `value` property is `null`.

## VStartTag

```js
interface VStartTag <: Node {
    type: "VStartTag"
    attributes: [ VAttribute ]
}
```

## VEndTag

```js
interface VEndTag <: Node {
    type: "VEndTag"
}
```

## VElement

```js
interface VElement <: Node {
    type: "VElement"
    namespace: string
    name: string
    startTag: VStartTag
    children: [ VText | VExpressionContainer | VElement ]
    endTag: VEndTag | null
    variables: [ Variable ]
}

interface Variable {
    id: Identifier
    kind: "v-for" | "scope"
    references: [ Reference ]
}
```

- `Variable` is objects but not `Node`. Those are variable declarations that child elements can use. The elements which have [`v-for` directives] or a special attribute [scope] can declare variables.
- `Variable#references` is an array of references which use this variable.

## VRootElement

```js
interface VRootElement <: VElement {
    tokens: [ Token ]
    comments: [ Token ]
    errors: [ ParseError ]
}

interface Token <: Node {
    type: string
    value: string
}

interface ParseError <: Error {
    code?: string
    message: string
    index: number
    lineNumber: number
    column: number
}
```

## Program

```js
extend interface Program {
    templateBody: VRootElement | null
}
```

This spec enhances [Program] nodes as it has the root node of `<template>`.
This supports only HTML for now. However, I'm going to add other languages Vue.js supports. The AST of other languages may be different form to VElement.

[ESTree]: https://github.com/estree/estree
[Program]: https://github.com/estree/estree/blob/master/es5.md#programs
[Node]: https://github.com/estree/estree/blob/master/es5.md#node-objects
[Statement]: https://github.com/estree/estree/blob/master/es5.md#statements
[BlockStatement]: https://github.com/estree/estree/blob/master/es5.md#blockstatement
[Expression]: https://github.com/estree/estree/blob/master/es5.md#expressions
[Literal]: https://github.com/estree/estree/blob/master/es5.md#literal
[Pattern]: https://github.com/estree/estree/blob/master/es5.md#patterns
[Identifier]: https://github.com/estree/estree/blob/master/es5.md#identifier
[ForInStatement]: https://github.com/estree/estree/blob/master/es5.md#forinstatement

[`v-for` directives]: https://vuejs.org/v2/api/#v-for
[`v-on` directives]: https://vuejs.org/v2/api/#v-on
[scope]: https://vuejs.org/v2/guide/components.html#Scoped-Slots
