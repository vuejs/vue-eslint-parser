"use strict"

const { spawn } = require("child_process")

function cd(path) {
    console.log("$ cd %s", path)
    process.chdir(path)
}

function sh(command) {
    console.log("$ %s", command)
    return new Promise((resolve, reject) => {
        spawn(command, [], { shell: true, stdio: "inherit" })
            .on("error", reject)
            .on("exit", (exitCode) => {
                if (exitCode) {
                    reject(new Error(`Exit with non-zero ${exitCode}`))
                } else {
                    resolve()
                }
            })
    })
}

;(async function main() {
    const requestedVersion = process.argv[2]
    const requestedVersionSpec = /^\d+\.\d+\.\d+$/u.test(requestedVersion)
        ? requestedVersion
        : `^${requestedVersion}`

    // Install ESLint of the requested version
    await sh(`npm install eslint@${requestedVersionSpec}`)

    // Install ESLint submodule of the requested version
    const installedVersion = require("eslint/package.json").version
    cd("test/fixtures/eslint")
    if (!installedVersion.startsWith("7.")) {
        await sh(`git checkout v${installedVersion}`)
    }
    if (installedVersion.startsWith("5.")) {
        await sh("npm install eslint-utils@1.4.0")
    }
    await sh("npm install")
})().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
