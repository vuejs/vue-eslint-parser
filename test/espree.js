"use strict"

const path = require("path")

/**
 * Spawn a child process to run `childMain()`.
 */
function parentMain() {
    const { spawn, execSync } = require("child_process")

    describe("Loading espree from ESLint", () => {
        it("should load espree from the ESLint location.", (done) => {
            spawn(process.execPath, [__filename, "--child1"], {
                stdio: "inherit",
            })
                .on("error", done)
                .on("exit", (code) =>
                    code
                        ? done(new Error(`Exited with non-zero: ${code}`))
                        : done(),
                )
        })
        it("should load espree from the ESLint location.", (done) => {
            spawn(process.execPath, [__filename, "--child1"], {
                stdio: "inherit",
            })
                .on("error", done)
                .on("exit", (code) =>
                    code
                        ? done(new Error(`Exited with non-zero: ${code}`))
                        : done(),
                )
        })
        it("should load espree from the user location.", (done) => {
            const originalCwd = process.cwd()
            try {
                process.chdir(path.join(__dirname, "./fixtures/espree-v8"))
                execSync("npm i", {
                    stdio: "inherit",
                })
                spawn(process.execPath, [__filename, "--child2"], {
                    stdio: "inherit",
                })
                    .on("error", done)
                    .on("exit", (code) =>
                        code
                            ? done(new Error(`Exited with non-zero: ${code}`))
                            : done(),
                    )
            } finally {
                process.chdir(originalCwd)
            }
        })
    })
}

/**
 * Check this parser loads the `espree` from the location of the loaded ESLint.
 */
function childMain1() {
    const assert = require("assert")
    const { Linter } = require("./fixtures/eslint")
    const linter = new Linter()
    linter.defineParser("vue-eslint-parser", require("../src"))

    const beforeEsprees = Object.keys(require.cache).filter(isEspreePath)

    linter.verify(
        "<script>'hello'</script>",
        { parser: "vue-eslint-parser" },
        { filename: "a.vue" },
    )

    const afterEsprees = Object.keys(require.cache).filter(isEspreePath)

    assert.strictEqual(
        afterEsprees.length,
        beforeEsprees.length,
        "espree should be loaded from the expected place",
    )
}

/**
 * Check this parser loads the `espree` from the location of the user dir.
 */
function childMain2() {
    const assert = require("assert")
    const { Linter } = require("./fixtures/eslint")
    const linter = new Linter()
    linter.defineParser("vue-eslint-parser", require("../src"))

    const result = linter.verify(
        "<script>await foo;</script>",
        {
            parser: "vue-eslint-parser",
            parserOptions: {
                parser: "espree",
                ecmaVersion: 2022,
                sourceType: "module",
            },
        },
        { filename: "a.vue" },
    )
    assert.strictEqual(
        result.length,
        0,
        "espree should be loaded from the fixtures/espree-v8",
    )
}

function isEspreePath(p) {
    return p.includes(`${path.sep}node_modules${path.sep}espree${path.sep}`)
}

if (process.argv.includes("--child1")) {
    childMain1()
} else if (process.argv.includes("--child2")) {
    childMain2()
} else {
    parentMain()
}
