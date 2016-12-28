# AST for `<template lang="html">`

Some types are featured from [ESTree].

- [Program]
- [Node]
- [Expression]
- [Literal]
- [Pattern]

## Node

```js
extend interface Node {
    range: [ number ]
}
```

This AST spec enhances the [Node] nodes as same as ESLint.
The `range` property is an array which has 2 integers.
The 1st integer is the offset of the start location of the node.
The 3st integer is the offset of the end location of the node.

## VIdentifier

```js
interface VIdentifier <: Node {
    type: "VIdentifier"
    name: string
}
```

- The `name` property can include any characters except U+0000-U+001F, U+007F-U+009F,
  U+0020, U+0022, U+0027, U+003E, U+002F, U+003D, U+FDD0-U+FDEF, U+FFFE, U+FFFF,
  U+1FFFE, U+1FFFF, U+2FFFE, U+2FFFF, U+3FFFE, U+3FFFF, U+4FFFE, U+4FFFF, U+5FFFE,
  U+5FFFF, U+6FFFE, U+6FFFF, U+7FFFE, U+7FFFF, U+8FFFE, U+8FFFF, U+9FFFE, U+9FFFF,
  U+AFFFE, U+AFFFF, U+BFFFE, U+BFFFF, U+CFFFE, U+CFFFF, U+DFFFE, U+DFFFF, U+EFFFE,
  U+EFFFF, U+FFFFE, U+FFFFF, U+10FFFE or U+10FFFF.

## VText

```js
interface VText <: Node {
    type: "VText"
    value: string
}
```

- Plain text of HTML.

## VExpressionContainer

```js
interface VExpressionContainer <: Node {
    type: "VExpressionContainer"
    expression: Expression | null
    syntaxError: Error | null
}
```

- If syntax errors exist, `expression` is `null` and `syntaxError` is an error object. Otherwise, `expression` is an [Expression] node and `syntaxError` is `null`.

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
- In the shorthand of `v-bind` cases, the `id` property is `":"` and the `shorthand` property is `true`.
- In the shorthand of `v-on` cases, the `id` property is `"@"` and the `shorthand` property is `true`.
- Otherwise, `shorthand` property is always `false`.

## VAttributeValue

```js
interface VAttributeValue <: Node {
    type: "VAttributeValue"
    value: string
    raw: string
}
```

- This is similar to [Literal] nodes but this is not always quoted.

## VAttribute

```js
interface VAttribute <: Node {
    type: "VAttribute"
    directive: boolean
    key: VIdentifier | VDirectiveKey
    value: VAttributeValue | VExpressionContainer | null
}
```

- If the `directive` property is `true`, this is a directive of Vue.js.  
  In that case, the `id` property is a `VDirectiveKey` node and the `value` property is a `VExpressionContainer` node.
- Otherwise, the `id` property is a `VIdentifier` node and the `value` property is a `VAttributeValue` node.
- If the `value` property is `null`, their attribute value does not exist.

## VStartTag

```js
interface VStartTag <: Node {
    type: "VStartTag"
    id: VIdentifier
    attributes: [ VAttribute ]
    selfClosing: boolean
}
```

If `selfClosing` is `true`, it means having `/`. E.g. `<br/>`.

## VEndTag

```js
interface VEndTag <: Node {
    type: "VEndTag"
    id: VIdentifier
}
```

## VElement

```js
interface VElement <: Node {
    type: "VElement"
    startTag: VStartTag
    children: [ VText | VExpressionContainer | VElement ]
    endTag: VEndTag | null
}
```

If `startTag.selfClosing` is `false` and `endTag` is `null`, the element does not have their end tag. E.g. `<li>Foo.`.

## Program

```js
extend interface Program {
    templateBody: VElement | null
}
```

This spec enhances [Program] nodes as it has the root node of `<template>`.
This supports only HTML for now. However, I'm going to add other languages Vue.js supports. The AST of other languages may be different form to VElement.

[ESTree]:     https://github.com/estree/estree
[Program]:    https://github.com/estree/estree/blob/master/es5.md#programs
[Node]:       https://github.com/estree/estree/blob/master/es5.md#node-objects
[Expression]: https://github.com/estree/estree/blob/master/es5.md#expression
[Literal]:    https://github.com/estree/estree/blob/master/es5.md#literal
[Pattern]:    https://github.com/estree/estree/blob/master/es5.md#patterns
