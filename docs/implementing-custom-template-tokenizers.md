# Implementing custom template tokenizers

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
     * Initialize this tokenizer.
     * @param text The contents of the <template> tag.
     * @param code The complete code content
     * @param {startingLine, startingColumn} The starting location of the text
     */
    constructor (text: string, code: string, { startingLine: number, startingColumn: number }) {
        
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
