# Implementing custom template tokenizers

**This is an experimental feature. It may be changed or deleted without notice in the minor version.**

A custom template tokenizer needs to create two types of tokens from the text it is given:

- Low level [tokens](https://github.com/vuejs/vue-eslint-parser/blob/master/src/ast/tokens.ts), which can be of an [existing HTML type](https://github.com/vuejs/vue-eslint-parser/blob/master/src/html/tokenizer.ts#L59) or even new types.
- Intermediate tokens, which **must** be of type `StartTag`, `EndTag`, `Text` or `Mustache` (see [IntermediateTokenizer](https://github.com/vuejs/vue-eslint-parser/blob/master/src/html/intermediate-tokenizer.ts#L33)).

Token ranges and locations must count from the start of the document. To help with this, custom tokenizers are initialized with a starting line and column.

## Interface

```ts
class CustomTokenizer {
    /**
     * The tokenized low level tokens, excluding comments.
     */
    tokens: Token[]
     /**
     * The tokenized low level comment tokens
     */
    comments: Token[]
    errors: ParseError[]

    /**
     * Used to control tokenization of {{ expressions }}. If false, don't produce VExpressionStart/End tokens
     */
    expressionEnabled: boolean = true

    /**
     * The current namespace. Set and used by the parser. You probably can ignore this.
     */
    namespace: string = "http://www.w3.org/1999/xhtml"

    /**
     * The current tokenizer state. Set by the parser. You can probably ignore this.
     */
    state: string = "DATA"

    /**
     * The complete source code text. Used by the parser and set via the constructor.
     */
    text: string

    /**
     * Initialize this tokenizer.
     * @param templateText The contents of the <template> tag.
     * @param text The complete source code
     * @param {startingLine, startingColumn} The starting location of the templateText. Your token positions need to include this offset.
     */
    constructor (templateText: string, text: string, { startingLine: number, startingColumn: number }) {
        this.text = text
    }

    /**
     * Get the next intermediate token.
     * @returns The intermediate token or null.
     */
    nextToken (): IntermediateToken | null {

    }
}
```

## Behaviour

When the html parser encounters a `<template lang="...">` tag that matches a configured custom tokenizer, it will initialize a new instance of this tokenizer with the contents of the template tag. It will then call the `nextToken` method of this tokenizer until it returns `null`. After having consumed all intermediate tokens it will copy the low level tokens, comments and errors from the tokenizer instance.

## Examples

For a working example, see [vue-eslint-parser-template-tokenizer-pug](https://github.com/rashfael/vue-eslint-parser-template-tokenizer-pug/).
