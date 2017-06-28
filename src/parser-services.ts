/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import EventEmitter from "events"
import NodeEventGenerator from "eslint/lib/util/node-event-generator"
import TokenStore from "eslint/lib/token-store"
import {traverseNodes, ESLintProgram} from "./ast"

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const emitters = new WeakMap<object, EventEmitter>()
const stores = new WeakMap<object, TokenStore>()

/**
 * Get or create the event emitter to traverse.
 * @param context The rule context.
 * @returns The emitter for this context.
 */
function ensureEmitter(context: any): EventEmitter {
    const ast = context.getSourceCode()
    let emitter = emitters.get(ast)

    if (!emitter) {
        emitter = new EventEmitter()
        emitters.set(ast, emitter)

        // Traverse
        context.eslint.on("Program:exit", (node: ESLintProgram) => {
            if (node.templateBody != null) {
                const generator = new NodeEventGenerator(emitter as EventEmitter)
                traverseNodes(node.templateBody, generator)
            }
        })
    }

    return emitter
}

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

export default {
    registerTemplateBodyVisitor(context: any, visitor: {[key: string]: Function}): void {
        const emitter = ensureEmitter(context)

        for (const selector of Object.keys(visitor)) {
            emitter.on(selector, visitor[selector])
        }
    },

    /**
     * Get the token store of the template body.
     * @param context The rule context to get.
     * @returns The token store of template body.
     */
    getTemplateBodyTokenStore(context: any): TokenStore {
        const ast = context.getSourceCode().ast.templateBody
        let store = stores.get(ast)

        if (!store) {
            store = (ast != null)
                ? new TokenStore(ast.tokens, ast.comments)
                : new TokenStore([], [])
            stores.set(ast, store)
        }

        return store
    },
}
