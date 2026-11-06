import { afterEach, assert, describe, it, vi } from "vitest"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"

function writePackage(dir: string, name: string, version: string) {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify({ name, version, main: "index.js" }),
    )
    fs.writeFileSync(
        path.join(dir, "index.js"),
        `module.exports = { version: ${JSON.stringify(version)} }`,
    )
}

describe("getEslintScope", () => {
    afterEach(() => {
        vi.restoreAllMocks()
        vi.resetModules()
    })

    // https://github.com/vuejs/vue-eslint-parser/issues/308
    it("should use the eslint-scope of ESLint if it is newer than the one in the user dir", async () => {
        const root = fs.mkdtempSync(path.join(os.tmpdir(), "eslint-scope-"))
        try {
            const nodeModules = path.join(root, "node_modules")
            writePackage(
                path.join(nodeModules, "eslint-scope"),
                "eslint-scope",
                "8.0.0",
            )
            writePackage(path.join(nodeModules, "eslint"), "eslint", "99.0.0")
            writePackage(
                path.join(nodeModules, "eslint/node_modules/eslint-scope"),
                "eslint-scope",
                "99.0.0",
            )

            vi.spyOn(process, "cwd").mockReturnValue(root)
            vi.resetModules()
            const { getEslintScope } =
                await import("../src/common/eslint-scope")
            assert.strictEqual(getEslintScope().version, "99.0.0")
        } finally {
            fs.rmSync(root, { recursive: true, force: true })
        }
    })
})
