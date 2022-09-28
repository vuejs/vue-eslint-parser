/**
 * @author Yosuke Ota
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const assert = require("assert")
const fs = require("fs")
const path = require("path")
const parser = require("../src")
const semver = require("semver")

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const ROOT = path.join(__dirname, "fixtures/types")
const TARGETS = fs
    .readdirSync(ROOT)
    .filter((f) => fs.statSync(path.join(ROOT, f)).isDirectory())
const PARSER_OPTIONS = {
    comment: true,
    ecmaVersion: 2020,
    loc: true,
    range: true,
    tokens: true,
    parser: {
        ts: parser.createTSESLintParserForVue(),
        "<template>": {
            parseForESLint(code, options) {
                return require("@typescript-eslint/parser").parseForESLint(
                    code,
                    { ...options, project: undefined },
                )
            },
        },
    },
    project: path.join(ROOT, "tsconfig.json"),
    extraFileExtensions: [".vue"],
}

// eslint-disable-next-line require-jsdoc -- X
function buildTypes(input, result) {
    const tsNodeMap = result.services.esTreeNodeToTSNodeMap
    const checker =
        result.services.program && result.services.program.getTypeChecker()

    const checked = new Set()

    const lines = input.split(/\r?\n/)
    const types = []

    function addType(node) {
        const tsNode = tsNodeMap.get(node)
        const type = checker.getTypeAtLocation(tsNode)
        const typeText = checker.typeToString(type)
        const lineTypes =
            types[node.loc.start.line - 1] ||
            (types[node.loc.start.line - 1] = [])
        if (node.type === "Identifier") {
            lineTypes.push(`${node.name}: ${typeText}`)
        } else {
            lineTypes.push(`${input.slice(...node.range)}: ${typeText}`)
        }
    }

    parser.AST.traverseNodes(result.ast, {
        visitorKeys: result.visitorKeys,
        enterNode(node, parent) {
            if (checked.has(parent)) {
                checked.add(node)
                return
            }

            if (
                node.type === "CallExpression" ||
                node.type === "Identifier" ||
                node.type === "MemberExpression"
            ) {
                addType(node)
                checked.add(node)
            }
        },
        leaveNode() {
            // noop
        },
    })
    return lines
        .map((l, i) => {
            if (!types[i]) {
                return l
            }
            return `${l} // ${types[i].join(", ").replace(/\n\s*/g, " ")}`
        })
        .join("\n")
}

//------------------------------------------------------------------------------
// Main
//------------------------------------------------------------------------------

describe("Template Types", () => {
    for (const name of TARGETS) {
        const sourcePath = path.join(ROOT, `${name}/source.vue`)
        const optionsPath = path.join(ROOT, `${name}/parser-options.json`)
        const requirementsPath = path.join(ROOT, `${name}/requirements.json`)
        const servicesPath = path.join(ROOT, `${name}/services.json`)
        const source = fs.readFileSync(sourcePath, "utf8")
        const parserOptions = fs.existsSync(optionsPath)
            ? JSON.parse(fs.readFileSync(optionsPath, "utf8"))
            : {}
        const requirements = fs.existsSync(requirementsPath)
            ? JSON.parse(fs.readFileSync(requirementsPath, "utf8"))
            : {}
        const services = fs.existsSync(servicesPath)
            ? JSON.parse(fs.readFileSync(servicesPath, "utf8"))
            : null
        const options = Object.assign(
            { filePath: sourcePath },
            PARSER_OPTIONS,
            parserOptions,
        )

        if (
            Object.entries(requirements).some(([pkgName, pkgVersion]) => {
                const version =
                    pkgName === "node"
                        ? process.version
                        : require(`${pkgName}/package.json`).version
                return !semver.satisfies(version, pkgVersion)
            })
        ) {
            continue
        }

        describe(`'test/fixtures/ast/${name}/source.vue'`, () => {
            it("should be parsed to valid Types.", () => {
                const result = parser.parseForESLint(source, options)
                const actual = buildTypes(source, result)
                const resultPath = path.join(ROOT, `${name}/types.vue`)

                if (!fs.existsSync(resultPath)) {
                    fs.writeFileSync(resultPath, actual)
                }
                const expected = fs.readFileSync(resultPath, "utf8")

                try {
                    assert.strictEqual(actual, expected)
                } catch (e) {
                    fs.writeFileSync(
                        path.join(ROOT, `${name}/actual-types.vue`),
                        actual,
                    )
                    throw e
                }
            })
        })
    }
})
