/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import EventEmitter from "events"
import NodeEventGenerator from "./external/node-event-generator"
import TokenStore from "./external/token-store"
import { traverseNodes, ESLintProgram, VElement } from "./ast"

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const emitters = new WeakMap<object, EventEmitter>()
const stores = new WeakMap<object, TokenStore>()

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

export interface ParserServices {
    /**
     * Define handlers to traverse the template body.
     * @param templateBodyVisitor The template body handlers.
     * @param scriptVisitor The script handlers. This is optional.
     */
    defineTemplateBodyVisitor(
        templateBodyVisitor: { [key: string]: (...args: any) => void },
        scriptVisitor?: { [key: string]: (...args: any) => void },
    ): object

    /**
     * Get the token store of the template body.
     * @returns The token store of template body.
     */
    getTemplateBodyTokenStore(): TokenStore
}

/**
 * Define the parser service
 * @param rootAST
 */
export function define(rootAST: ESLintProgram): ParserServices {
    return {
        /**
         * Define handlers to traverse the template body.
         * @param templateBodyVisitor The template body handlers.
         * @param scriptVisitor The script handlers. This is optional.
         */
        defineTemplateBodyVisitor(
            templateBodyVisitor: { [key: string]: (...args: any) => void },
            scriptVisitor?: { [key: string]: (...args: any) => void },
        ): object {
            if (scriptVisitor == null) {
                scriptVisitor = {} //eslint-disable-line no-param-reassign
            }
            if (rootAST.templateBody == null) {
                return scriptVisitor
            }

            let emitter = emitters.get(rootAST)

            // If this is the first time, initialize the intermediate event emitter.
            if (emitter == null) {
                emitters.set(rootAST, (emitter = new EventEmitter()))

                const programExitHandler = scriptVisitor["Program:exit"]
                scriptVisitor["Program:exit"] = node => {
                    try {
                        if (typeof programExitHandler === "function") {
                            programExitHandler(node)
                        }

                        // Traverse template body.
                        const generator = new NodeEventGenerator(
                            emitter as EventEmitter,
                        )
                        traverseNodes(
                            rootAST.templateBody as VElement,
                            generator,
                        )
                    } finally {
                        // @ts-ignore
                        scriptVisitor["Program:exit"] = programExitHandler
                        emitters.delete(rootAST)
                    }
                }
            }

            // Register handlers into the intermediate event emitter.
            for (const selector of Object.keys(templateBodyVisitor)) {
                emitter.on(selector, templateBodyVisitor[selector])
            }

            return scriptVisitor
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
                store =
                    ast != null
                        ? new TokenStore(ast.tokens, ast.comments)
                        : new TokenStore([], [])
                stores.set(key, store)
            }

            return store
        },
    }
}
