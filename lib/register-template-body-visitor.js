/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2016 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const EventEmitter = require("events")
const NodeEventGenerator = require("eslint/lib/util/node-event-generator")
const traverseNodes = require("./traverse-nodes")

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const emitters = new WeakMap()

/**
 * Get or create the event emitter to traverse.
 * @param {RuleContext} context The rule context.
 * @returns {EventEmitter} The emitter for this context.
 */
function ensureEmitter(context) {
    const key = context.getSourceCode()
    if (emitters.has(key)) {
        return emitters.get(key)
    }
    const emitter = new EventEmitter()
    emitters.set(key, emitter)

    // Traverse
    context.eslint.on("Program:exit", (node) => {
        if (node.templateBody != null) {
            const generator = new NodeEventGenerator(emitter)
            traverseNodes(node.templateBody, generator)
        }
    })

    return emitter
}

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

module.exports = (context, visitor) => {
    const emitter = ensureEmitter(context)

    for (const selector of Object.keys(visitor)) {
        emitter.on(selector, visitor[selector])
    }
}
