import type * as escopeTypes from "eslint-scope"
import type { ParserOptions } from "../common/parser-options"
import type {
    Reference,
    VAttribute,
    VDirective,
    VDocumentFragment,
    VElement,
    VExpressionContainer,
} from "../ast/index"
import { traverseNodes } from "../ast/index"
import { getEslintScope } from "../common/eslint-scope"
import {
    findGenericDirective,
    isScriptElement,
    isScriptSetupElement,
} from "../common/ast-utils"
import { camelize } from "../utils/utils"

const BUILTIN_COMPONENTS = new Set([
    "template",
    "slot",
    "component",
    "Component",
    "transition",
    "Transition",
    "transition-group",
    "TransitionGroup",
    "keep-alive",
    "KeepAlive",
    "teleport",
    "Teleport",
    "suspense",
    "Suspense",
])

const BUILTIN_DIRECTIVES = new Set([
    "bind",
    "on",
    "text",
    "html",
    "show",
    "if",
    "else",
    "else-if",
    "for",
    "model",
    "slot",
    "pre",
    "cloak",
    "once",
    "memo",
    "is",
])

/**
 * @see https://github.com/vuejs/core/blob/48de8a42b7fed7a03f7f1ff5d53d6a704252cafe/packages/shared/src/domTagConfig.ts#L5-L28
 */
// https://developer.mozilla.org/en-US/docs/Web/HTML/Element
const HTML_TAGS =
    "html,body,base,head,link,meta,style,title,address,article,aside,footer," +
    "header,h1,h2,h3,h4,h5,h6,nav,section,div,dd,dl,dt,figcaption," +
    "figure,picture,hr,img,li,main,ol,p,pre,ul,a,b,abbr,bdi,bdo,br,cite,code," +
    "data,dfn,em,i,kbd,mark,q,rp,rt,ruby,s,samp,small,span,strong,sub,sup," +
    "time,u,var,wbr,area,audio,map,track,video,embed,object,param,source," +
    "canvas,script,noscript,del,ins,caption,col,colgroup,table,thead,tbody,td," +
    "th,tr,button,datalist,fieldset,form,input,label,legend,meter,optgroup," +
    "option,output,progress,select,textarea,details,dialog,menu," +
    "summary,template,blockquote,iframe,tfoot"

// https://developer.mozilla.org/en-US/docs/Web/SVG/Element
const SVG_TAGS =
    "svg,animate,animateMotion,animateTransform,circle,clipPath,color-profile," +
    "defs,desc,discard,ellipse,feBlend,feColorMatrix,feComponentTransfer," +
    "feComposite,feConvolveMatrix,feDiffuseLighting,feDisplacementMap," +
    "feDistanceLight,feDropShadow,feFlood,feFuncA,feFuncB,feFuncG,feFuncR," +
    "feGaussianBlur,feImage,feMerge,feMergeNode,feMorphology,feOffset," +
    "fePointLight,feSpecularLighting,feSpotLight,feTile,feTurbulence,filter," +
    "foreignObject,g,hatch,hatchpath,image,line,linearGradient,marker,mask," +
    "mesh,meshgradient,meshpatch,meshrow,metadata,mpath,path,pattern," +
    "polygon,polyline,radialGradient,rect,set,solidcolor,stop,switch,symbol," +
    "text,textPath,title,tspan,unknown,use,view"

const NATIVE_TAGS = new Set([...HTML_TAGS.split(","), ...SVG_TAGS.split(",")])

const COMPILER_MACROS_AT_ROOT = new Set([
    "defineProps",
    "defineEmits",
    "defineExpose",
    "withDefaults",
    // Added in Vue 3.3
    "defineOptions",
    "defineSlots",
    // Added in Vue 3.4
    "defineModel",
])

function capitalize(str: string) {
    return str[0].toUpperCase() + str.slice(1)
}

/**
 * Analyze `<script setup>` scope.
 * This method does the following process:
 *
 * 1. Add a virtual reference to the variables used in the template to mark them as used.
 * (This is the same way typescript-eslint marks a `React` variable.)
 *
 * 2. If compiler macros were used, add these variables as global variables.
 */
export function analyzeScriptSetupScope(
    scopeManager: escopeTypes.ScopeManager,
    templateBody: VElement | undefined,
    df: VDocumentFragment,
    parserOptions: ParserOptions,
): void {
    analyzeUsedInTemplateVariables(scopeManager, templateBody, df)

    analyzeScriptSetupVariables(scopeManager, df, parserOptions)
}

function extractVariables(scopeManager: escopeTypes.ScopeManager) {
    const scriptVariables = new Map<string, escopeTypes.Variable>()
    const globalScope = scopeManager.globalScope
    if (!globalScope) {
        return scriptVariables
    }
    for (const variable of globalScope.variables) {
        scriptVariables.set(variable.name, variable)
    }
    const moduleScope = globalScope.childScopes.find(
        (scope) => scope.type === "module",
    )
    for (const variable of moduleScope?.variables ?? []) {
        scriptVariables.set(variable.name, variable)
    }
    return scriptVariables
}

/**
 * Analyze the variables used in the template.
 * Add a virtual reference to the variables used in the template to mark them as used.
 * (This is the same way typescript-eslint marks a `React` variable.)
 */
function analyzeUsedInTemplateVariables(
    scopeManager: escopeTypes.ScopeManager,
    templateBody: VElement | undefined,
    df: VDocumentFragment,
) {
    const scriptVariables = extractVariables(scopeManager)

    const markedVariables = new Set<string>()

    /**
     * @see https://github.com/vuejs/vue-next/blob/48de8a42b7fed7a03f7f1ff5d53d6a704252cafe/packages/compiler-core/src/transforms/transformElement.ts#L335
     */
    function markSetupReferenceVariableAsUsed(name: string) {
        if (scriptVariables.has(name)) {
            markVariableAsUsed(name)
            return true
        }
        const camelName = camelize(name)
        if (scriptVariables.has(camelName)) {
            markVariableAsUsed(camelName)
            return true
        }
        const pascalName = capitalize(camelName)
        if (scriptVariables.has(pascalName)) {
            markVariableAsUsed(pascalName)
            return true
        }
        return false
    }

    function markVariableAsUsed(nameOrRef: string | Reference) {
        let name: string
        let isValueReference: boolean | undefined
        let isTypeReference: boolean | undefined
        if (typeof nameOrRef === "string") {
            name = nameOrRef
        } else {
            name = nameOrRef.id.name
            isValueReference = nameOrRef.isValueReference
            isTypeReference = nameOrRef.isTypeReference
        }
        const variable = scriptVariables.get(name)
        if (!variable || variable.identifiers.length === 0) {
            return
        }
        if (markedVariables.has(name)) {
            return
        }
        markedVariables.add(name)

        const reference = new (getEslintScope().Reference)()
        ;(reference as any).vueUsedInTemplate = true // Mark for debugging.
        reference.from = variable.scope
        reference.identifier = variable.identifiers[0]
        reference.isWrite = () => false
        reference.isWriteOnly = () => false
        reference.isRead = () => true
        reference.isReadOnly = () => true
        reference.isReadWrite = () => false
        // For typescript-eslint
        reference.isValueReference = isValueReference
        reference.isTypeReference = isTypeReference

        variable.references.push(reference)
        reference.resolved = variable

        if (reference.isTypeReference) {
            // @typescript-eslint/no-unused-vars treats type references at the same position as recursive references,
            // so without this flag it will be marked as unused.
            ;(variable as any).eslintUsed = true
        }
    }

    function processVExpressionContainer(node: VExpressionContainer) {
        for (const reference of node.references.filter(
            (ref) => ref.variable == null,
        )) {
            markVariableAsUsed(reference)
        }
    }

    function processVElement(node: VElement) {
        if (
            (node.rawName === node.name && NATIVE_TAGS.has(node.rawName)) ||
            BUILTIN_COMPONENTS.has(node.rawName)
        ) {
            return
        }
        if (!markSetupReferenceVariableAsUsed(node.rawName)) {
            // Check namespace
            // https://github.com/vuejs/vue-next/blob/48de8a42b7fed7a03f7f1ff5d53d6a704252cafe/packages/compiler-core/src/transforms/transformElement.ts#L306
            const dotIndex = node.rawName.indexOf(".")
            if (dotIndex > 0) {
                markSetupReferenceVariableAsUsed(
                    node.rawName.slice(0, dotIndex),
                )
            }
        }
    }

    function processVAttribute(node: VAttribute | VDirective) {
        if (node.directive) {
            if (BUILTIN_DIRECTIVES.has(node.key.name.name)) {
                return
            }
            markSetupReferenceVariableAsUsed(`v-${node.key.name.rawName}`)
        } else if (node.key.name === "ref" && node.value) {
            markVariableAsUsed(node.value.value)
        }
    }

    if (templateBody) {
        // Analyze `<template>`
        traverseNodes(templateBody, {
            enterNode(node) {
                if (node.type === "VExpressionContainer") {
                    processVExpressionContainer(node)
                } else if (node.type === "VElement") {
                    processVElement(node)
                } else if (node.type === "VAttribute") {
                    processVAttribute(node)
                }
            },
            leaveNode() {
                /* noop */
            },
        })
    }

    for (const child of df.children) {
        if (child.type === "VElement") {
            if (isScriptSetupElement(child)) {
                // Analyze <script setup lang="ts" generic="...">
                const generic = findGenericDirective(child)
                if (generic) {
                    processVExpressionContainer(generic.value)
                }
            } else if (child.name === "style") {
                // Analyze CSS v-bind()
                for (const node of child.children) {
                    if (node.type === "VExpressionContainer") {
                        processVExpressionContainer(node)
                    }
                }
            }
        }
    }
}

/**
 * Analyze <script setup> variables.
 * - Analyze compiler macros.
 *   If compiler macros were used, add these variables as global variables.
 * - Generic variables.
 *   If defined generics are used, add these variables as global variables.
 */
function analyzeScriptSetupVariables(
    scopeManager: escopeTypes.ScopeManager,
    df: VDocumentFragment,
    parserOptions: ParserOptions,
) {
    const globalScope = scopeManager.globalScope
    if (!globalScope) {
        return
    }
    const customMacros = new Set(
        parserOptions.vueFeatures?.customMacros &&
        Array.isArray(parserOptions.vueFeatures.customMacros)
            ? parserOptions.vueFeatures.customMacros
            : [],
    )

    const genericDefineNames = new Set<string>()
    const scriptElements = df.children.filter(isScriptElement)
    const scriptSetupElement = scriptElements.find(isScriptSetupElement)
    if (scriptSetupElement && findGenericDirective(scriptSetupElement)) {
        for (const variable of scriptSetupElement.variables) {
            if (variable.kind === "generic") {
                genericDefineNames.add(variable.id.name)
            }
        }
    }

    const newThrough: escopeTypes.Reference[] = []
    for (const reference of globalScope.through) {
        if (
            COMPILER_MACROS_AT_ROOT.has(reference.identifier.name) ||
            customMacros.has(reference.identifier.name)
        ) {
            if (
                reference.from.type === "global" ||
                reference.from.type === "module"
            ) {
                addCompilerMacroVariable(reference)
                // This reference is removed from `Scope#through`.
                continue
            }
        }
        if (genericDefineNames.has(reference.identifier.name)) {
            addGenericVariable(reference)
            // This reference is removed from `Scope#through`.
            continue
        }

        newThrough.push(reference)
    }

    globalScope.through = newThrough

    function addCompilerMacroVariable(reference: escopeTypes.Reference) {
        addVariable(globalScope, reference)
    }

    function addGenericVariable(reference: escopeTypes.Reference) {
        addVariable(globalScope, reference)
    }
}

function addVariable(
    scope: escopeTypes.Scope,
    reference: escopeTypes.Reference,
) {
    const name = reference.identifier.name
    let variable = scope.set.get(name)
    if (!variable) {
        variable = new (getEslintScope().Variable)()
        variable.name = name
        variable.scope = scope
        scope.variables.push(variable)
        scope.set.set(name, variable)
    }
    // Links the variable and the reference.
    reference.resolved = variable
    variable.references.push(reference)
}
