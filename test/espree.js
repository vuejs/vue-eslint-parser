"use strict"

const path = require("path")

/**
 * Spawn a child process to run `childMain()`.
 */
function parentMain() {
    const { spawn } = require("child_process")

    describe("Loading espree from ESLint", () => {
        it("should load espree from the ESLint location.", done => {
            spawn(process.execPath, [__filename, "--child"], {
                stdio: "inherit",
            })
                .on("error", done)
                .on("exit", code =>
                    code
                        ? done(new Error(`Exited with non-zero: ${code}`))
                        : done()
                )
        })
    })
}

/**
 * Check this parser loads the `espree` from the location of the loaded ESLint.
 */
function childMain() {
    const assert = require("assert")
    const { Linter } = require("./fixtures/eslint")
    const linter = new Linter()
    linter.defineParser("vue-eslint-parser", require("../src"))

    const beforeEsprees = Object.keys(require.cache).filter(isEspreePath)

    linter.verify(
        "<script>'hello'</script>",
        { parser: "vue-eslint-parser" },
        { filename: "a.vue" }
    )

    const afterEsprees = Object.keys(require.cache).filter(isEspreePath)

    assert.strictEqual(
        afterEsprees.length,
        beforeEsprees.length,
        "espree should be loaded from the expected place"
    )
}

function isEspreePath(p) {
    return p.includes(`${path.sep}node_modules${path.sep}espree${path.sep}`)
}

if (process.argv.includes("--child")) {
    childMain()
} else {
    parentMain()
}
