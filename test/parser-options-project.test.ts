import { describe, it, assert } from "vitest"
import { parseForESLint } from "../src"
import * as espree from "espree"
import type { Linter } from "eslint"

describe("use `project: undefined` when parsing template script-let", () => {
    it("should be the project option is defined only once in Simple SFC.", () => {
        let projectCount = 0
        parseForESLint(
            `<template>
                <div v-bind:class="{}">
                    <template v-for="item in items">
                        {{ 'str' }}
                        <button v-on:click="handler()"></button>
                    </template>
                    <MyComponent>
                        <template v-slot="{a}">
                            <div v-if="a">A</div>
                        </template>
                    </MyComponent>
                </div>
            </template>
            <script>
            export default {}
            </script>
            `,
            {
                project: true,
                sourceType: "module",
                ecmaVersion: "latest",
                parser: {
                    parseForESLint(code, options) {
                        if (options.project) {
                            projectCount++
                        }

                        return {
                            ast: espree.parse(code, options),
                        }
                    },
                } satisfies Linter.Parser,
            },
        )
        assert.strictEqual(projectCount, 1)
    })
    it("should be the project option is defined only once in <script setup>.", () => {
        let projectCount = 0
        parseForESLint(
            `<script setup>
            let items = ["foo"]
            </script>
            <template>
                <div v-bind:class="{}">
                    <template v-for="item in items">
                        {{ 'str' }}
                        <button v-on:click="handler()"></button>
                    </template>
                    <MyComponent>
                        <template v-slot="{a}">
                            <div v-if="a">A</div>
                        </template>
                    </MyComponent>
                </div>
            </template>
            <style scoped>
            .a {
                color: v-bind(color)
            }
            </style>
            `,
            {
                project: true,
                sourceType: "module",
                ecmaVersion: "latest",
                parser: {
                    parseForESLint(code, options) {
                        if (options.project) {
                            projectCount++
                        }

                        return {
                            ast: espree.parse(code, options),
                        }
                    },
                } satisfies Linter.Parser,
            },
        )
        assert.strictEqual(projectCount, 1)
    })

    it("should be the project option is defined only once in <script setup> with <script>.", () => {
        let projectCount = 0
        parseForESLint(
            `<script>
            import { ref } from 'vue'
            </script>
            <script setup>
            let items = ref(["foo"])
            </script>
            <template>
                <div v-bind:class="{}">
                    <template v-for="item in items">
                        {{ 'str' }}
                        <button v-on:click="handler()"></button>
                    </template>
                    <MyComponent>
                        <template v-slot="{a}">
                            <div v-if="a">A</div>
                        </template>
                    </MyComponent>
                </div>
            </template>
            `,
            {
                project: true,
                sourceType: "module",
                ecmaVersion: "latest",
                parser: {
                    parseForESLint(code, options) {
                        if (options.project) {
                            projectCount++
                        }

                        return {
                            ast: espree.parse(code, options),
                        }
                    },
                } satisfies Linter.Parser,
            },
        )
        assert.strictEqual(projectCount, 1)
    })
})
