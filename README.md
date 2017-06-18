# vue-eslint-parser

[![npm version](https://img.shields.io/npm/v/vue-eslint-parser.svg)](https://www.npmjs.com/package/vue-eslint-parser)
[![Downloads/month](https://img.shields.io/npm/dm/vue-eslint-parser.svg)](http://www.npmtrends.com/vue-eslint-parser)
[![Build Status](https://travis-ci.org/mysticatea/vue-eslint-parser.svg?branch=master)](https://travis-ci.org/mysticatea/vue-eslint-parser)
[![Coverage Status](https://codecov.io/gh/mysticatea/vue-eslint-parser/branch/master/graph/badge.svg)](https://codecov.io/gh/mysticatea/vue-eslint-parser)
[![Dependency Status](https://david-dm.org/mysticatea/vue-eslint-parser.svg)](https://david-dm.org/mysticatea/vue-eslint-parser)

The ESLint custom parser for `.vue` files.

ESLint supports autofix on custom parsers but does not support autofix on plugins which have processors ([eslint/eslint#7510](https://github.com/eslint/eslint/issues/7510)). The motivation of this custom parser is that it supports autofix on `.vue` files.

## :cd: Installation

```bash
$ npm install --save-dev eslint vue-eslint-parser
```

- `vue-eslint-parser` requires ESLint 3.9.0 or later.

## :book: Usage

1. Write `parser` option in your `.eslintrc.*` file.
2. Use glob patterns or `--ext .vue` CLI option.

```json
{
    "extends": "eslint:recommended",
    "parser": "vue-eslint-parser"
}
```

```bash
$ eslint "src/**/*.{js,vue}"
# or
$ eslint src --ext .vue
```

## :wrench: Options

`parserOptions` has the same properties as what [espree](https://github.com/eslint/espree#usage), the default parser of ESLint, is supporting.  
For example:

```json
{
    "parser": "vue-eslint-parser",
    "parserOptions": {
        "sourceType": "module",
        "ecmaVersion": 2017,
        "ecmaFeatures": {
            "globalReturn": false,
            "impliedStrict": false,
            "jsx": false,
            "experimentalObjectRestSpread": false
        }
    }
}
```

Also, you can use `parser` property to specify a custom parser to parse `<script>` tags.
Other properties than parser would be given to the specified parser.  
For example:

```json
{
    "parser": "vue-eslint-parser",
    "parserOptions": {
        "parser": "babel-eslint",
        "sourceType": "module",
        "allowImportExportEverywhere": false
    }
}
```

```json
{
    "parser": "vue-eslint-parser",
    "parserOptions": {
        "parser": "typescript-eslint-parser"
    }
}
```

## :book: Usage for custom rules / plugins

`vue-eslint-parser` provides `parserServices` to traverse `<template>`.

The spec of `<template>` AST is [here](./docs/ast.md).

TODO: write examples.

## :warning: Known Limitations

Some rules make warnings due to the outside of `<script>` tags.
Please disable those rules for `.vue` files as necessary.

- [eol-last](http://eslint.org/docs/rules/eol-last)
- [linebreak-style](http://eslint.org/docs/rules/linebreak-style)
- [max-len](http://eslint.org/docs/rules/max-len)
- [max-lines](http://eslint.org/docs/rules/max-lines)
- [no-trailing-spaces](http://eslint.org/docs/rules/no-trailing-spaces)
- [unicode-bom](http://eslint.org/docs/rules/unicode-bom)
- Other rules which are using the source code text instead of AST might be confused as well.

## :newspaper: Changelog

- [GitHub Releases](https://github.com/mysticatea/vue-eslint-parser/releases)

## :muscle: Contributing

Welcome contributing!

Please use GitHub's Issues/PRs.

### Development Tools

- `npm test` runs tests and measures coverage.
- `npm run coverage` shows the coverage result of `npm test` command with the default browser.
- `npm run clean` removes the coverage result of `npm test` command.
- `npm run lint` runs ESLint.
- `npm run setup` setups submodules to develop.
- `npm run update-fixtures` updates files in `test/fixtures/template-ast` directory based on `*.source.vue` files.
- `npm run watch` runs tests with `--watch` option.
