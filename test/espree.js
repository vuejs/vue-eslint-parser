"use strict"

const path = require("path")

/**
 * Spawn a child process to run `childMain()`.
 */
function parentMain() {
    const { spawn, execSync } = require("child_process")

    for (const loc of ["./fixtures/espree-v8", "./fixtures/eslint-v6"]) {
        describe(`Loading espree for ${loc}`, () => {
            it("should load espree from latest.", (done) => {
                const originalCwd = process.cwd()
                try {
                    process.chdir(path.join(__dirname, loc))
                    execSync("npm i", {
                        stdio: "inherit",
                    })
                    spawn(
                        process.execPath,
                        [
                            "--require",
                            "ts-node/register",
                            __filename,
                            "--child",
                        ],
                        {
                            stdio: "inherit",
                        },
                    )
                        .on("error", done)
                        .on("exit", (code) =>
                            code
                                ? done(
                                      new Error(
                                          `Exited with non-zero: ${code}`,
                                      ),
                                  )
                                : done(),
                        )
                } finally {
                    process.chdir(originalCwd)
                }
            })
        })
    }
}

/**
 * Check this parser loads the `espree` from the location of the user dir.
 */
function childMain() {
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
                ecmaVersion: "latest",
                sourceType: "module",
            },
        },
        { filename: "a.vue" },
    )
    assert.strictEqual(
        result.length,
        0,
        "espree should be loaded from the " + process.cwd(),
    )
}

if (process.argv.includes("--child")) {
    childMain()
} else {
    parentMain()
}
