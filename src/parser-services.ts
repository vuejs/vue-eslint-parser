/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import { Rule } from "eslint"
import EventEmitter from "events"
import NodeEventGenerator from "./external/node-event-generator"
import TokenStore from "./external/token-store"
import {
    traverseNodes,
    ESLintProgram,
    VElement,
    VDocumentFragment,
    VAttribute,
} from "./ast"
import { LocationCalculator } from "./common/location-calculator"
import {
    createCustomBlockSharedContext,
    CustomBlockContext,
    ESLintCustomBlockParser,
    getCustomBlocks,
    getLang,
    parseCustomBlockElement,
} from "./sfc/custom-block"

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

type CustomBlockVisitorFactory = (
    context: CustomBlockContext,
) =>
    | {
          [key: string]: (...args: any) => void
      }
    | null
    | undefined

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
     * Define handlers to traverse custom blocks.
     * @param context The rule context.
     * @param parser The custom parser.
     * @param rule The custom block rule definition
     * @param scriptVisitor The script handlers. This is optional.
     */
    defineCustomBlocksVisitor(
        context: Rule.RuleContext,
        parser: ESLintCustomBlockParser,
        rule: {
            target:
                | string
                | string[]
                | ((lang: string | null, customBlock: VElement) => boolean)
            create: CustomBlockVisitorFactory
        },
        scriptVisitor: { [key: string]: (...args: any) => void },
    ): { [key: string]: (...args: any) => void }

    /**
     * Get the token store of the template body.
     * @returns The token store of template body.
     */
    getTemplateBodyTokenStore(): TokenStore

    /**
     * Get the root document fragment.
     * @returns The root document fragment.
     */
    getDocumentFragment(): VDocumentFragment | null
}

/**
 * Define the parser service
 * @param rootAST
 */
export function define(
    sourceText: string,
    rootAST: ESLintProgram,
    document: VDocumentFragment | null,
    globalLocationCalculator: LocationCalculator | null,
    { parserOptions }: { parserOptions: object },
): ParserServices {
    const customBlocksEmitters = new Map<
        ESLintCustomBlockParser,
        {
            context: Rule.RuleContext
            test: (lang: string | null, customBlock: VElement) => boolean
            create: CustomBlockVisitorFactory
        }[]
    >()

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
                emitter = new EventEmitter()
                emitter.setMaxListeners(0)
                emitters.set(rootAST, emitter)

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
                        // eslint-disable-next-line @mysticatea/ts/ban-ts-ignore
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
         * Define handlers to traverse custom blocks.
         * @param context The rule context.
         * @param parser The custom parser.
         * @param rule The custom block rule definition
         * @param scriptVisitor The script handlers. This is optional.
         */
        defineCustomBlocksVisitor(
            context: Rule.RuleContext,
            parser: ESLintCustomBlockParser,
            rule: {
                target:
                    | string
                    | string[]
                    | ((lang: string | null, customBlock: VElement) => boolean)
                create: CustomBlockVisitorFactory
            },
            scriptVisitor: { [key: string]: (...args: any) => void },
        ): { [key: string]: (...args: any) => void } {
            if (scriptVisitor == null) {
                scriptVisitor = {} //eslint-disable-line no-param-reassign
            }
            parserOptions = { ...parserOptions } //eslint-disable-line no-param-reassign
            const customBlocks = getCustomBlocks(document).filter(
                block =>
                    block.endTag &&
                    !block.startTag.attributes.some(
                        (attr): attr is VAttribute =>
                            !attr.directive && attr.key.name === "src",
                    ),
            )
            if (!customBlocks.length || globalLocationCalculator == null) {
                return {}
            }
            let factories = customBlocksEmitters.get(parser)

            // If this is the first time, initialize the intermediate event emitter.
            if (factories == null) {
                factories = []
                customBlocksEmitters.set(parser, factories)
                const visitorFactories = factories

                const programExitHandler = scriptVisitor["Program:exit"]
                scriptVisitor["Program:exit"] = node => {
                    try {
                        if (typeof programExitHandler === "function") {
                            programExitHandler(node)
                        }
                        for (const customBlock of customBlocks) {
                            const lang = getLang(customBlock)

                            const activeVisitorFactories = visitorFactories.filter(
                                f => f.test(lang, customBlock),
                            )
                            if (!activeVisitorFactories.length) {
                                continue
                            }

                            const parsedResult = parseCustomBlockElement(
                                customBlock,
                                parser,
                                globalLocationCalculator,
                                parserOptions,
                            )

                            const {
                                serCurrentNode,
                                context: customBlockContext,
                            } = createCustomBlockSharedContext({
                                text: sourceText,
                                customBlock,
                                parsedResult,
                                parserOptions,
                            })

                            const emitter = new EventEmitter()
                            emitter.setMaxListeners(0)

                            for (const factory of activeVisitorFactories) {
                                const visitor = factory.create({
                                    ...factory.context,
                                    ...customBlockContext,
                                })
                                // Register handlers into the intermediate event emitter.
                                for (const selector of Object.keys(
                                    visitor || {},
                                )) {
                                    emitter.on(selector, visitor![selector])
                                }
                            }

                            // Traverse custom block.
                            const generator = new NodeEventGenerator(emitter)
                            traverseNodes(parsedResult.ast, {
                                visitorKeys: parsedResult.visitorKeys,
                                enterNode(n) {
                                    serCurrentNode(n)
                                    generator.enterNode(n)
                                },
                                leaveNode(n) {
                                    serCurrentNode(n)
                                    generator.leaveNode(n)
                                },
                            })
                        }
                    } finally {
                        // eslint-disable-next-line @mysticatea/ts/ban-ts-ignore
                        // @ts-ignore
                        scriptVisitor["Program:exit"] = programExitHandler
                        customBlocksEmitters.delete(parser)
                    }
                }
            }

            const target = rule.target
            const test =
                typeof target === "function"
                    ? target
                    : Array.isArray(target)
                    ? (lang: string | null) =>
                          Boolean(lang && target.includes(lang))
                    : (lang: string | null) => target === lang
            factories.push({
                context,
                test,
                create: rule.create,
            })

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

        /**
         * Get the root document fragment.
         * @returns The root document fragment.
         */
        getDocumentFragment(): VDocumentFragment | null {
            return document
        },
    }
}
