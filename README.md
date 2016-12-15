# vue-eslint-parser

[![npm version](https://img.shields.io/npm/v/vue-eslint-parser.svg)](https://www.npmjs.com/package/vue-eslint-parser)
[![Downloads/month](https://img.shields.io/npm/dm/vue-eslint-parser.svg)](http://www.npmtrends.com/vue-eslint-parser)
[![Build Status](https://travis-ci.org/mysticatea/vue-eslint-parser.svg?branch=master)](https://travis-ci.org/mysticatea/vue-eslint-parser)
[![Coverage Status](https://codecov.io/gh/mysticatea/vue-eslint-parser/branch/master/graph/badge.svg)](https://codecov.io/gh/mysticatea/vue-eslint-parser)
[![Dependency Status](https://david-dm.org/mysticatea/vue-eslint-parser.svg)](https://david-dm.org/mysticatea/vue-eslint-parser)

The ESLint custom parser of `.vue` file.

ESLint supports autofix on custom parsers but does not support autofix on plugins which have processors ([eslint/eslint#7510](https://github.com/eslint/eslint/issues/7510)). The motivation of this custom parser is that it supports autofix on `.vue` files.

## :cd: Installation

```bash
$ npm install --save-dev eslint vue-eslint-parser
```

- `vue-eslint-parser` requires ESLint 3.5.0 or later.

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
$ eslint "src/**.{js,vue}"
# or
$ eslint src --ext .vue
```

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
- `npm run watch` runs tests with `--watch` option.
