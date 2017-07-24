/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

const readline = require("readline")
const chokidar = require("chokidar")
const spawn = require("cross-spawn")
const lodash = require("lodash")

//------------------------------------------------------------------------------
// Parse arguments
//------------------------------------------------------------------------------

const args = (() => {
    const allArgs = process.argv.slice(2)
    const i = allArgs.indexOf("--")
    return {
        patterns: allArgs.slice(0, i),
        command: allArgs[i + 1],
        arguments: allArgs.slice(i + 2),
    }
})()

//------------------------------------------------------------------------------
// Normalize SIGINT
//------------------------------------------------------------------------------

if (process.platform === "win32") {
    let rl = null
    process.on("newListener", (type) => {
        if (type === "SIGINT" && process.listenerCount("SIGINT") === 1) {
            rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            })
            rl.on("SIGINT", process.emit.bind(process, "SIGINT"))
        }
    })
    process.on("removeListener", (type) => {
        if (type === "SIGINT" && rl && process.listenerCount("SIGINT") === 0) {
            rl.close()
            rl = null
        }
    })
}

//------------------------------------------------------------------------------
// Define exec.
//------------------------------------------------------------------------------

let running = false
let dirty = false
const requestCommand = lodash.debounce(() => {
    if (running) {
        dirty = true
        return
    }
    running = true

    /**
     * Finalize.
     * @param {any} x The exit code or error object.
     * @returns {void}
     */
    function done(x) {
        running = false
        if (dirty) {
            dirty = false
            requestCommand()
        }
        if (x instanceof Error) {
            console.error("FAILED TO EXEC:", x.message)
        }
    }

    spawn(args.command, args.arguments, {stdio: "inherit"})
        .on("exit", done)
        .on("error", done)
}, 1000)

//------------------------------------------------------------------------------
// Setup watcher.
//------------------------------------------------------------------------------

const watcher = chokidar.watch(args.patterns, {ignoreInitial: true})
watcher.on("all", (event, path) => {
    console.log(`${event}:${path}`)
    requestCommand()
})
watcher.on("error", (error) => {
    console.error("Error:", error)
    console.error(error.stack)
})

watcher.once("ready", () => {
    const list = args.patterns.join("\", \"")
    console.log("Watching", `"${list}" ..`)
})

//------------------------------------------------------------------------------
// Setup SIGINT
//------------------------------------------------------------------------------

process.on("SIGINT", () => {
    console.log("<<SIGINT>> $", args.command, args.arguments.join(" "))
    watcher.close()
})
