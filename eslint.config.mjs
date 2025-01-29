import prettier from "eslint-plugin-prettier"
import typescriptEslint from "@typescript-eslint/eslint-plugin"
import eslintComments from "eslint-plugin-eslint-comments"
import node from "eslint-plugin-n"
import nodeDeps from "eslint-plugin-node-dependencies"
import tsParser from "@typescript-eslint/parser"
import jsonParser from "jsonc-eslint-parser"
import path from "node:path"
import { fileURLToPath } from "node:url"
import js from "@eslint/js"
import { FlatCompat } from "@eslint/eslintrc"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all,
})

export default [
    {
        ignores: [
            ".nyc_output",
            ".temp",
            "coverage",
            "**/node_modules",
            "src/html/util/alternative-cr.ts",
            "src/html/util/attribute-names.ts",
            "src/html/util/entities.ts",
            "src/html/util/tag-names.ts",
            "test/fixtures",
            "test/temp",
            "index.d.ts",
            "index.js",
        ],
    },
    ...nodeDeps.configs["flat/recommended"],
    ...compat.extends(
        "plugin:node-dependencies/recommended",
        "plugin:jsonc/recommended-with-jsonc",
    ),
    {
        files: ["js", "mjs", "ts", "json"].flatMap((ext) => [
            "*." + ext,
            "**/*." + ext,
        ]),
        plugins: {
            prettier,
        },

        languageOptions: {
            globals: {
                root: "off",
            },

            ecmaVersion: "latest",
            sourceType: "module",

            parserOptions: {
                ecmaFeatures: {
                    globalReturn: false,
                },

                loggerFn: false,
                project: "tsconfig.json",
            },
        },

        settings: {
            node: {
                tryExtensions: [".ts", ".js", ".json"],
            },
        },

        rules: {
            "prettier/prettier": [
                "error",
                {
                    tabWidth: 4,
                    semi: false,
                    trailingComma: "all",
                },
                {
                    usePrettierrc: false,
                },
            ],
        },
    },
    {
        files: ["*.json", "**/*.json"],
        languageOptions: {
            parser: jsonParser,
        },

        rules: {
            "prettier/prettier": [
                "error",
                {
                    tabWidth: 2,
                    semi: false,
                    trailingComma: "all",
                },
                {
                    usePrettierrc: false,
                },
            ],
        },
    },
    {
        files: ["**/*.ts"],

        plugins: {
            "@typescript-eslint": typescriptEslint,
            "eslint-comments": eslintComments,
            node,
        },

        languageOptions: {
            parser: tsParser,
            globals: {
                process: "readonly",
                require: "readonly",
            },
        },

        rules: {
            "prettier/prettier": [
                "error",
                {
                    tabWidth: 4,
                    semi: false,
                    trailingComma: "all",
                    parser: "typescript",
                },
                {
                    usePrettierrc: false,
                },
            ],

            "@typescript-eslint/consistent-type-imports": "error",
            "no-duplicate-imports": "off",
            // "@typescript-eslint/no-duplicate-imports": "error",
            "@typescript-eslint/no-var-requires": "off",

            "node/no-unsupported-features/es-syntax": [
                "off",
                {
                    ignores: ["modules", "dynamicImport"],
                },
            ],

            "node/no-extraneous-import": ["error"],

            "node/file-extension-in-import": [
                "error",
                "always",
                {
                    ".js": "never",
                    ".ts": "never",
                    ".tsx": "never",
                },
            ],

            "node/no-missing-import": ["error"],
            "node/no-unpublished-import": ["error"],
            "node/exports-style": ["error", "module.exports"],
            "node/no-callback-literal": ["off"],
            "node/no-deprecated-api": ["error"],
            "node/no-exports-assign": ["error"],
            "node/no-extraneous-require": ["error"],
            "node/no-missing-require": ["error"],
            "node/no-unpublished-bin": ["error"],
            "node/no-unpublished-require": ["error"],
            "node/no-unsupported-features/es-builtins": ["error"],
            "node/no-unsupported-features/node-builtins": ["error"],
            "node/prefer-global/buffer": ["error"],
            "node/prefer-global/console": ["error"],
            "node/prefer-global/process": ["error"],
            "node/prefer-global/text-decoder": ["off"],
            "node/prefer-global/text-encoder": ["off"],
            "node/prefer-global/url-search-params": ["off"],
            "node/prefer-global/url": ["off"],
            "node/prefer-promises/dns": ["off"],
            "node/prefer-promises/fs": ["off"],
            "node/process-exit-as-throw": ["error"],
            "node/shebang": ["error"],
            "@typescript-eslint/adjacent-overload-signatures": ["error"],
            "@typescript-eslint/array-type": ["error"],
            "@typescript-eslint/await-thenable": ["error"],
            "@typescript-eslint/ban-ts-comment": ["error"],
            "@typescript-eslint/consistent-type-assertions": ["error"],
            "@typescript-eslint/explicit-member-accessibility": ["error"],
            "@typescript-eslint/no-array-constructor": ["error"],
            "@typescript-eslint/no-empty-interface": ["error"],
            "@typescript-eslint/no-extraneous-class": ["error"],
            "@typescript-eslint/no-floating-promises": ["error"],
            "@typescript-eslint/no-for-in-array": ["error"],
            "@typescript-eslint/no-inferrable-types": ["error"],
            "@typescript-eslint/no-misused-new": ["error"],
            "@typescript-eslint/no-misused-promises": ["error"],
            "@typescript-eslint/parameter-properties": ["error"],
            "@typescript-eslint/no-require-imports": ["error"],

            "@typescript-eslint/no-this-alias": [
                "error",
                {
                    allowDestructuring: true,
                },
            ],

            "@typescript-eslint/no-unnecessary-qualifier": ["error"],
            "@typescript-eslint/no-unnecessary-type-arguments": ["error"],
            "@typescript-eslint/no-unnecessary-type-assertion": ["error"],
            "@typescript-eslint/prefer-function-type": ["off"],
            "@typescript-eslint/prefer-includes": ["error"],
            "@typescript-eslint/prefer-namespace-keyword": ["error"],
            "@typescript-eslint/prefer-readonly": ["off"],
            "@typescript-eslint/prefer-regexp-exec": ["error"],
            "@typescript-eslint/prefer-string-starts-ends-with": ["error"],
            "@typescript-eslint/restrict-plus-operands": ["error"],
            "@typescript-eslint/require-array-sort-compare": ["error"],
            "@typescript-eslint/triple-slash-reference": ["error"],

            "@typescript-eslint/unbound-method": [
                "off",
                {
                    ignoreStatic: true,
                },
            ],

            "@typescript-eslint/unified-signatures": ["off"],
            camelcase: ["off"],
            "no-empty-function": ["off"],
            "@typescript-eslint/no-empty-function": ["error"],
            "no-useless-constructor": ["off"],
            "@typescript-eslint/no-useless-constructor": ["error"],
            "require-await": ["off"],
            "@typescript-eslint/require-await": ["error"],
            "func-style": ["off", "declaration"],
            "init-declarations": ["off"],
            "lines-between-class-members": ["off"],
            "no-dupe-class-members": ["off"],
            "no-invalid-this": ["off"],
            "no-loop-func": ["off"],

            "no-redeclare": [
                "off",
                {
                    builtinGlobals: true,
                },
            ],

            "no-undef": [
                "error",
                {
                    typeof: true,
                },
            ],

            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    args: "all",
                    argsIgnorePattern: "^_(?:[^_].*)?$",
                    caughtErrors: "all",
                    vars: "all",
                    varsIgnorePattern: "^_(?:[^_].*)?$",
                },
            ],

            "no-use-before-define": ["off", "nofunc"],

            "one-var": [
                "off",
                {
                    initialized: "never",
                    uninitialized: "always",
                },
            ],

            "@typescript-eslint/ban-types": ["off"],
            "@typescript-eslint/brace-style": ["off"],
            "@typescript-eslint/consistent-type-definitions": ["off"],
            "@typescript-eslint/explicit-function-return-type": ["off"],
            "@typescript-eslint/func-call-spacing": ["off"],
            "@typescript-eslint/generic-type-naming": ["off"],
            "@typescript-eslint/indent": ["off"],
            "@typescript-eslint/member-delimiter-style": ["off"],
            "@typescript-eslint/member-ordering": ["off"],
            "@typescript-eslint/no-explicit-any": ["off"],
            "@typescript-eslint/no-extra-parens": ["off"],
            "@typescript-eslint/no-magic-numbers": ["off"],
            "@typescript-eslint/no-namespace": ["off"],
            "@typescript-eslint/no-non-null-assertion": ["off"],
            "@typescript-eslint/no-type-alias": ["off"],
            "@typescript-eslint/no-unnecessary-condition": ["off"],
            "@typescript-eslint/no-use-before-define": ["off"],
            "@typescript-eslint/prefer-for-of": ["off"],
            "@typescript-eslint/promise-function-async": ["off"],
            "@typescript-eslint/quotes": ["off"],
            "@typescript-eslint/semi": ["off"],
            "@typescript-eslint/strict-boolean-expressions": ["off"],
            "@typescript-eslint/type-annotation-spacing": ["off"],
            "@typescript-eslint/typedef": ["off"],
            "arrow-body-style": ["error"],
            "constructor-super": ["error"],
            "default-param-last": ["error"],
            "no-class-assign": ["error"],
            "no-const-assign": ["error"],
            "no-import-assign": ["error"],
            "no-new-symbol": ["error"],
            "no-template-curly-in-string": ["error"],
            "no-this-before-super": ["error"],
            "no-useless-computed-key": ["error"],
            "no-useless-rename": ["error"],
            "no-var": ["error"],

            "object-shorthand": [
                "error",
                "always",
                {
                    avoidExplicitReturnArrows: true,
                },
            ],

            "prefer-arrow-callback": ["error"],
            "prefer-const": ["error"],
            "prefer-numeric-literals": ["error"],
            "prefer-rest-params": ["error"],
            "prefer-spread": ["error"],
            "prefer-template": ["error"],
            "require-unicode-regexp": ["error"],
            "require-yield": ["error"],
            "symbol-description": ["error"],
            "class-methods-use-this": ["warn"],
            "arrow-parens": ["off"],
            "arrow-spacing": ["off"],
            "generator-star-spacing": ["off"],
            "no-confusing-arrow": ["off"],
            "rest-spread-spacing": ["off"],
            "template-curly-spacing": ["off"],
            "yield-star-spacing": ["off"],
            "no-inner-declarations": ["off", "functions"],
            "no-restricted-imports": ["off"],
            "prefer-destructuring": ["off"],
            "sort-imports": ["off"],

            "accessor-pairs": [
                "error",
                {
                    enforceForClassMembers: true,
                    getWithoutSet: false,
                    setWithoutGet: true,
                },
            ],

            "array-callback-return": ["error"],
            "consistent-return": ["error"],
            curly: ["error"],
            "default-case": ["error"],
            "dot-notation": ["error"],

            eqeqeq: [
                "error",
                "always",
                {
                    null: "ignore",
                },
            ],

            "for-direction": ["error"],
            "getter-return": ["error"],
            "linebreak-style": ["error", "unix"],

            "max-statements-per-line": [
                "error",
                {
                    max: 1,
                },
            ],

            "multiline-comment-style": ["error", "separate-lines"],
            "new-cap": ["error"],
            "no-alert": ["error"],
            "no-array-constructor": ["error"],
            "no-async-promise-executor": ["error"],
            "no-caller": ["error"],
            "no-case-declarations": ["error"],
            "no-compare-neg-zero": ["error"],
            "no-cond-assign": ["error"],
            "no-constant-condition": ["error"],
            "no-control-regex": ["error"],
            "no-debugger": ["error"],
            "no-delete-var": ["error"],
            "no-div-regex": ["error"],
            "no-dupe-args": ["error"],
            "no-dupe-keys": ["error"],
            "no-duplicate-case": ["error"],
            "no-else-return": ["error"],
            "no-empty": ["error"],
            "no-empty-character-class": ["error"],
            "no-empty-pattern": ["error"],
            "no-eval": ["error"],
            "no-ex-assign": ["error"],
            "no-extend-native": ["error"],
            "no-extra-bind": ["error"],
            "no-extra-boolean-cast": ["error"],
            "no-extra-label": ["error"],
            "no-fallthrough": ["error"],
            "no-func-assign": ["error"],
            "no-global-assign": ["error"],
            "no-implicit-coercion": ["error"],
            "no-implicit-globals": ["error"],
            "no-implied-eval": ["error"],
            "no-invalid-regexp": ["error"],

            "no-irregular-whitespace": [
                "error",
                {
                    skipComments: false,
                    skipRegExps: false,
                    skipStrings: false,
                    skipTemplates: false,
                },
            ],

            "no-iterator": ["error"],
            "no-label-var": ["error"],
            "no-lone-blocks": ["error"],
            "no-lonely-if": ["error"],
            "no-misleading-character-class": ["error"],

            "no-mixed-operators": [
                "error",
                {
                    groups: [
                        ["&", "|", "^", "~", "<<", ">>", ">>>"],
                        ["&&", "||"],
                    ],
                    allowSamePrecedence: true,
                },
            ],

            "no-new": ["error"],
            "no-new-object": ["error"],
            "no-new-require": ["error"],
            "no-new-wrappers": ["error"],
            "no-obj-calls": ["error"],
            "no-octal": ["error"],
            "no-octal-escape": ["error"],

            "no-param-reassign": [
                "error",
                {
                    props: false,
                },
            ],

            "no-process-env": ["error"],
            "no-process-exit": ["error"],
            "no-prototype-builtins": ["error"],
            "no-regex-spaces": ["error"],

            "no-restricted-properties": [
                "error",
                {
                    property: "__count__",
                },
                {
                    property: "__noSuchMethod__",
                },
                {
                    property: "__parent__",
                },
                {
                    property: "__defineGetter__",
                },
                {
                    property: "__defineSetter__",
                },
                {
                    property: "__lookupGetter__",
                },
                {
                    property: "__lookupSetter__",
                },
            ],

            "no-return-assign": ["error"],
            "no-return-await": ["error"],
            "no-script-url": ["error"],

            "no-self-assign": [
                "error",
                {
                    props: true,
                },
            ],

            "no-self-compare": ["error"],
            "no-sequences": ["error"],

            "@typescript-eslint/no-shadow": [
                "error",
                {
                    builtinGlobals: true,
                    hoist: "functions",
                },
            ],

            "no-shadow-restricted-names": ["error"],
            "no-sparse-arrays": ["error"],
            "no-tabs": ["error"],
            "no-throw-literal": ["error"],
            "no-unexpected-multiline": ["error"],
            "no-unmodified-loop-condition": ["error"],
            "no-unneeded-ternary": ["error"],
            "no-unreachable": ["error"],
            "no-unsafe-finally": ["error"],

            "no-unsafe-negation": [
                "error",
                {
                    enforceForOrderingRelations: true,
                },
            ],

            "no-unused-expressions": ["error"],
            "no-unused-labels": ["error"],
            "no-useless-call": ["error"],
            "no-useless-catch": ["error"],
            "no-useless-concat": ["error"],
            "no-useless-escape": ["error"],
            "no-useless-return": ["error"],
            "no-void": ["error"],
            "no-with": ["error"],

            "padding-line-between-statements": [
                "error",
                {
                    blankLine: "always",
                    next: "*",
                    prev: "directive",
                },
                {
                    blankLine: "always",
                    next: "function",
                    prev: "*",
                },
                {
                    blankLine: "always",
                    next: "*",
                    prev: "function",
                },
            ],

            "prefer-promise-reject-errors": ["error"],
            "prefer-regex-literals": ["error"],

            quotes: [
                "error",
                "double",
                {
                    avoidEscape: true,
                },
            ],

            radix: ["error"],
            "require-atomic-updates": ["error"],

            "spaced-comment": [
                "error",
                "always",
                {
                    block: {
                        balanced: true,

                        markers: [
                            "eslint",
                            "eslint-env",
                            "eslint-disable",
                            "eslint-enable",
                            "exported",
                            "globals",
                            "istanbul",
                        ],
                    },

                    line: {
                        exceptions: ["-", "="],

                        markers: [
                            "eslint-disable-line",
                            "eslint-disable-next-line",
                            "istanbul",
                            "TODO:",
                            "FIXME:",
                        ],
                    },
                },
            ],

            strict: ["error", "global"],

            "use-isnan": [
                "error",
                {
                    enforceForIndexOf: true,
                    enforceForSwitchCase: true,
                },
            ],

            "valid-typeof": [
                "error",
                {
                    requireStringLiterals: true,
                },
            ],

            yoda: [
                "error",
                "never",
                {
                    exceptRange: true,
                    onlyEquality: false,
                },
            ],

            complexity: [
                "warn",
                {
                    max: 16,
                },
            ],

            "max-nested-callbacks": [
                "warn",
                {
                    max: 4,
                },
            ],

            "max-params": [
                "warn",
                {
                    max: 8,
                },
            ],

            "no-console": [
                "warn",
                {
                    allow: ["assert", "error"],
                },
            ],

            "array-bracket-newline": ["off"],
            "array-bracket-spacing": ["off"],
            "array-element-newline": ["off"],
            "block-spacing": ["off"],
            "brace-style": ["off"],
            "comma-dangle": ["off"],
            "comma-spacing": ["off"],
            "comma-style": ["off"],
            "computed-property-spacing": ["off"],
            "dot-location": ["off"],
            "eol-last": ["off"],
            "func-call-spacing": ["off"],
            "function-call-argument-newline": ["off"],
            "function-paren-newline": ["off"],
            "implicit-arrow-linebreak": ["off"],
            indent: ["off"],
            "jsx-quotes": ["off"],
            "key-spacing": ["off"],
            "keyword-spacing": ["off"],
            "multiline-ternary": ["off"],
            "new-parens": ["off"],
            "newline-per-chained-call": ["off"],
            "no-extra-parens": ["off"],
            "no-extra-semi": ["off"],
            "no-floating-decimal": ["off"],
            "no-mixed-spaces-and-tabs": ["off"],
            "no-multi-spaces": ["off"],
            "no-multiple-empty-lines": ["off"],
            "no-trailing-spaces": ["off"],
            "no-whitespace-before-property": ["off"],
            "nonblock-statement-body-position": ["off"],
            "object-curly-newline": ["off"],
            "object-curly-spacing": ["off"],
            "object-property-newline": ["off"],
            "one-var-declaration-per-line": ["off"],
            "operator-linebreak": ["off"],
            "padded-blocks": ["off"],
            "quote-props": ["off"],
            semi: ["off"],
            "semi-spacing": ["off"],
            "semi-style": ["off"],
            "space-before-blocks": ["off"],
            "space-before-function-paren": ["off"],
            "space-in-parens": ["off"],
            "space-infix-ops": ["off"],
            "space-unary-ops": ["off"],
            "switch-colon-spacing": ["off"],
            "template-tag-spacing": ["off"],
            "unicode-bom": ["off"],
            "wrap-iife": ["off"],
            "wrap-regex": ["off"],
            "block-scoped-var": ["off"],
            "callback-return": ["off"],
            "capitalized-comments": ["off"],
            "consistent-this": ["off"],
            "func-name-matching": ["off"],
            "func-names": ["off"],
            "global-require": ["off"],
            "guard-for-in": ["off"],
            "handle-callback-err": ["off"],
            "id-blacklist": ["off"],
            "id-length": ["off"],
            "id-match": ["off"],
            "line-comment-position": ["off"],
            "lines-around-comment": ["off"],
            "max-classes-per-file": ["off"],
            "max-depth": ["off"],
            "max-len": ["off"],
            "max-lines": ["off"],
            "max-lines-per-function": ["off"],
            "max-statements": ["off"],
            "no-await-in-loop": ["off"],
            "no-bitwise": ["off"],
            "no-buffer-constructor": ["off"],
            "no-continue": ["off"],
            "no-eq-null": ["off"],
            "no-inline-comments": ["off"],
            "no-labels": ["off"],
            "no-magic-numbers": ["off"],
            "no-mixed-requires": ["off"],
            "no-multi-assign": ["off"],
            "no-multi-str": ["off"],
            "no-negated-condition": ["off"],
            "no-nested-ternary": ["off"],
            "no-new-func": ["off"],
            "no-path-concat": ["off"],
            "no-plusplus": ["off"],
            "no-proto": ["off"],
            "no-restricted-globals": ["off"],
            "no-restricted-modules": ["off"],
            "no-restricted-syntax": ["off"],
            "no-sync": ["off"],
            "no-ternary": ["off"],
            "no-undef-init": ["off"],
            "no-undefined": ["off"],
            "no-underscore-dangle": ["off"],
            "no-warning-comments": ["off"],
            "operator-assignment": ["off"],
            "prefer-named-capture-group": ["off"],
            "prefer-object-spread": ["off"],
            "sort-keys": ["off"],
            "sort-vars": ["off"],
            "vars-on-top": ["off"],
            "eslint-comments/disable-enable-pair": ["error"],
            "eslint-comments/no-aggregating-enable": ["error"],
            "eslint-comments/no-duplicate-disable": ["error"],
            "eslint-comments/no-restricted-disable": ["off"],
            "eslint-comments/no-unlimited-disable": ["error"],
            "eslint-comments/no-unused-disable": ["error"],
            "eslint-comments/no-unused-enable": ["error"],

            "eslint-comments/no-use": [
                "error",
                {
                    allow: [
                        "eslint-disable",
                        "eslint-disable-line",
                        "eslint-disable-next-line",
                        "eslint-enable",
                        "eslint-env",
                        "globals",
                    ],
                },
            ],
        },
    },
    {
        files: ["typings/**"],

        rules: {
            "node/no-missing-import": [
                "error",
                {
                    allowModules: ["estree"],
                },
            ],
        },
    },
    {
        files: ["**/package.json"],

        rules: {
            "@mysticatea/prettier": "off",
        },
    },
]
