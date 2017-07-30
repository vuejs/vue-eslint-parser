/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import assert from "assert"
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
    const ast = context.getSourceCode().ast
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

/**
 * Define the parser service
 * @param rootAST 
 */
export function define(rootAST: ESLintProgram) {
    return {
        registerTemplateBodyVisitor(context: any, visitor: {[key: string]: Function}): void {
            assert(context.getSourceCode().ast === rootAST)
            const emitter = ensureEmitter(context)

            for (const selector of Object.keys(visitor)) {
                emitter.on(selector, visitor[selector])
            }
        },

        /**
         * Get the token store of the template body.
         * @returns The token store of template body.
         */
        getTemplateBodyTokenStore(): TokenStore {
            const ast = rootAST.templateBody
            const key = ast || stores
            let store = stores.get(key)

            if (!store) {
                store = (ast != null)
                    ? new TokenStore(ast.tokens, ast.comments)
                    : new TokenStore([], [])
                stores.set(key, store)
            }

            return store
        },
    }
}
