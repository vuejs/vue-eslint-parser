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

    const packageVersions = [`eslint@${requestedVersionSpec}`]

    if (requestedVersion === "10") {
        packageVersions.push("espree@11", "eslint-scope@9")
    } else if (Number(requestedVersion) < 10) {
        packageVersions.push("espree@10", "eslint-scope@8")
    }

    // Install ESLint of the requested version
    await sh(`npm install ${packageVersions.join(" ")} -f`)
    if (Number(requestedVersion) < 9) {
        await sh(`npm install @types/eslint -D -f`)
    }

    // Install ESLint submodule of the requested version
    // const installedVersion = require("eslint/package.json").version
    // cd("test/fixtures/eslint")
    // if (!installedVersion.startsWith("8.")) {
    //     await sh(`git checkout v${installedVersion}`)
    // }
    // if (installedVersion.startsWith("5.")) {
    //     await sh("npm install eslint-utils@1.4.0")
    // }
    // await sh("npm install -f")
})().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
