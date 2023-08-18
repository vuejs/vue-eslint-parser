/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import assert from "assert"
import last from "lodash/last"
import findLastIndex from "lodash/findLastIndex"
import type {
    ErrorCode,
    HasLocation,
    Namespace,
    Token,
    VAttribute,
    VDocumentFragment,
    VElement,
    VExpressionContainer,
    VLiteral,
} from "../ast"
import { NS, ParseError } from "../ast"
import { debug } from "../common/debug"
import { LocationCalculatorForHtml } from "../common/location-calculator"
import {
    convertToDirective,
    processMustache,
    resolveReferences,
} from "../template"
import {
    MATHML_ATTRIBUTE_NAME_MAP,
    SVG_ATTRIBUTE_NAME_MAP,
} from "./util/attribute-names"
import {
    HTML_CAN_BE_LEFT_OPEN_TAGS,
    HTML_NON_FHRASING_TAGS,
    HTML_RAWTEXT_TAGS,
    HTML_RCDATA_TAGS,
    HTML_VOID_ELEMENT_TAGS,
    SVG_ELEMENT_NAME_MAP,
} from "./util/tag-names"
import type {
    IntermediateToken,
    EndTag,
    Mustache,
    StartTag,
    Text,
} from "./intermediate-tokenizer"
import { IntermediateTokenizer } from "./intermediate-tokenizer"
import type { Tokenizer } from "./tokenizer"
import type { ParserOptions } from "../common/parser-options"
import {
    isSFCFile,
    getScriptParser,
    getParserLangFromSFC,
} from "../common/parser-options"
import sortedIndexBy from "lodash/sortedIndexBy"
import sortedLastIndexBy from "lodash/sortedLastIndexBy"
import type {
    CustomTemplateTokenizer,
    CustomTemplateTokenizerConstructor,
} from "./custom-tokenizer"
import { isScriptSetupElement, isTSLang } from "../common/ast-utils"

const DIRECTIVE_NAME = /^(?:v-|[.:@#]).*[^.:@#]$/u
const DT_DD = /^d[dt]$/u
const DUMMY_PARENT: any = Object.freeze({})

/**
 * Gets the tag name from the given node or token.
 * For SFC, it returns the value of `rawName` to be case sensitive.
 */
function getTagName(
    startTagOrElement: { name: string; rawName: string },
    isSFC: boolean,
) {
    return isSFC ? startTagOrElement.rawName : startTagOrElement.name
}

/**
 * Check whether the element is a MathML text integration point or not.
 * @see https://html.spec.whatwg.org/multipage/parsing.html#tree-construction-dispatcher
 * @param element The current element.
 * @param isSFC For SFC, give `true`.
 * @returns `true` if the element is a MathML text integration point.
 */
function isMathMLIntegrationPoint(element: VElement, isSFC: boolean): boolean {
    if (element.namespace === NS.MathML) {
        const name = getTagName(element, isSFC)
        return (
            name === "mi" ||
            name === "mo" ||
            name === "mn" ||
            name === "ms" ||
            name === "mtext"
        )
    }
    return false
}

/**
 * Check whether the element is a HTML integration point or not.
 * @see https://html.spec.whatwg.org/multipage/parsing.html#tree-construction-dispatcher
 * @param element The current element.
 * @param isSFC For SFC, give `true`.
 * @returns `true` if the element is a HTML integration point.
 */
function isHTMLIntegrationPoint(element: VElement, isSFC: boolean): boolean {
    if (element.namespace === NS.MathML) {
        return (
            getTagName(element, isSFC) === "annotation-xml" &&
            element.startTag.attributes.some(
                (a) =>
                    a.directive === false &&
                    a.key.name === "encoding" &&
                    a.value != null &&
                    (a.value.value === "text/html" ||
                        a.value.value === "application/xhtml+xml"),
            )
        )
    }
    if (element.namespace === NS.SVG) {
        const name = getTagName(element, isSFC)
        return name === "foreignObject" || name === "desc" || name === "title"
    }

    return false
}

/**
 * Adjust element names by the current namespace.
 * @param name The lowercase element name to adjust.
 * @param namespace The current namespace.
 * @returns The adjusted element name.
 */
function adjustElementName(name: string, namespace: Namespace): string {
    if (namespace === NS.SVG) {
        return SVG_ELEMENT_NAME_MAP.get(name) || name
    }
    return name
}

/**
 * Adjust attribute names by the current namespace.
 * @param name The lowercase attribute name to adjust.
 * @param namespace The current namespace.
 * @returns The adjusted attribute name.
 */
function adjustAttributeName(name: string, namespace: Namespace): string {
    if (namespace === NS.SVG) {
        return SVG_ATTRIBUTE_NAME_MAP.get(name) || name
    }
    if (namespace === NS.MathML) {
        return MATHML_ATTRIBUTE_NAME_MAP.get(name) || name
    }
    return name
}

/**
 * Set the location of the last child node to the end location of the given node.
 * @param node The node to commit the end location.
 */
function propagateEndLocation(node: VDocumentFragment | VElement): void {
    const lastChild =
        (node.type === "VElement" ? node.endTag : null) || last(node.children)
    if (lastChild != null) {
        node.range[1] = lastChild.range[1]
        node.loc.end = lastChild.loc.end
    }
}

/**
 * The parser of HTML.
 * This is not following to the HTML spec completely because Vue.js template spec is pretty different to HTML.
 */
export class Parser {
    private tokenizer: IntermediateTokenizer | CustomTemplateTokenizer
    private locationCalculator: LocationCalculatorForHtml
    private baseParserOptions: ParserOptions
    private isSFC: boolean
    private document: VDocumentFragment
    private elementStack: VElement[]
    private vPreElement: VElement | null
    private postProcessesForScript: ((
        htmlParserOptions: ParserOptions,
        scriptParserOptions: ParserOptions,
    ) => void)[] = []

    /**
     * The source code text.
     */
    private get text(): string {
        return this.tokenizer.text
    }

    /**
     * The tokens.
     */
    private get tokens(): Token[] {
        return this.tokenizer.tokens
    }

    /**
     * The comments.
     */
    private get comments(): Token[] {
        return this.tokenizer.comments
    }

    /**
     * The twig expressions.
     */
    private get twigExpressions(): Token[] {
        return this.tokenizer.twigExpressions
    }

    /**
     * The syntax errors which are found in this parsing.
     */
    private get errors(): ParseError[] {
        return this.tokenizer.errors
    }

    /**
     * The current namespace.
     */
    private get namespace(): Namespace {
        return this.tokenizer.namespace
    }
    private set namespace(value: Namespace) {
        this.tokenizer.namespace = value
    }

    /**
     * The current flag of expression enabled.
     */
    private get expressionEnabled(): boolean {
        return this.tokenizer.expressionEnabled
    }
    private set expressionEnabled(value: boolean) {
        this.tokenizer.expressionEnabled = value
    }

    /**
     * Get the current node.
     */
    private get currentNode(): VDocumentFragment | VElement {
        return last(this.elementStack) || this.document
    }

    /**
     * Check if the current location is in a v-pre element.
     */
    private get isInVPreElement(): boolean {
        return this.vPreElement != null
    }

    /**
     * Initialize this parser.
     * @param tokenizer The tokenizer to parse.
     * @param parserOptions The parser options to parse inline expressions.
     */
    public constructor(tokenizer: Tokenizer, parserOptions: ParserOptions) {
        this.tokenizer = new IntermediateTokenizer(tokenizer)
        this.locationCalculator = new LocationCalculatorForHtml(
            tokenizer.gaps,
            tokenizer.lineTerminators,
        )
        this.baseParserOptions = parserOptions
        this.isSFC = isSFCFile(parserOptions)
        this.document = {
            type: "VDocumentFragment",
            range: [0, 0],
            loc: {
                start: { line: 1, column: 0 },
                end: { line: 1, column: 0 },
            },
            parent: null,
            children: [],
            tokens: this.tokens,
            comments: this.comments,
            twigExpressions: this.twigExpressions,
            errors: this.errors,
        }
        this.elementStack = []
        this.vPreElement = null

        this.postProcessesForScript = []
    }

    /**
     * Parse the HTML which was given in this constructor.
     * @returns The result of parsing.
     */
    public parse(): VDocumentFragment {
        let token: IntermediateToken | null = null
        while ((token = this.tokenizer.nextToken()) != null) {
            ;(this as any)[token.type](token)
        }

        this.popElementStackUntil(0)
        propagateEndLocation(this.document)

        const doc = this.document

        const htmlParserOptions = {
            ...this.baseParserOptions,
            parser: getScriptParser(
                this.baseParserOptions.parser,
                function* () {
                    yield "<template>"
                    yield getParserLangFromSFC(doc)
                },
            ),
        }
        const scriptParserOptions = {
            ...this.baseParserOptions,
            parser: getScriptParser(this.baseParserOptions.parser, () =>
                getParserLangFromSFC(doc),
            ),
        }
        for (const proc of this.postProcessesForScript) {
            proc(htmlParserOptions, scriptParserOptions)
        }
        this.postProcessesForScript = []

        return doc
    }

    /**
     * Report an invalid character error.
     * @param code The error code.
     */
    private reportParseError(token: HasLocation, code: ErrorCode): void {
        const error = ParseError.fromCode(
            code,
            token.range[0],
            token.loc.start.line,
            token.loc.start.column,
        )
        this.errors.push(error)

        debug("[html] syntax error:", error.message)
    }

    /**
     * Pop an element from the current element stack.
     */
    private popElementStack(): void {
        assert(this.elementStack.length >= 1)

        const element = this.elementStack.pop()!
        propagateEndLocation(element)

        // Update the current namespace.
        const current = this.currentNode
        this.namespace =
            current.type === "VElement" ? current.namespace : NS.HTML

        // Update v-pre state.
        if (this.vPreElement === element) {
            this.vPreElement = null
            this.expressionEnabled = true
        }

        // Update expression flag.
        if (this.elementStack.length === 0) {
            this.expressionEnabled = false
        }
    }

    /**
     * Pop elements from the current element stack.
     * @param index The index of the element you want to pop.
     */
    private popElementStackUntil(index: number): void {
        while (this.elementStack.length > index) {
            this.popElementStack()
        }
    }

    /**
     * Gets the tag name from the given node or token.
     * For SFC, it returns the value of `rawName` to be case sensitive.
     */
    private getTagName(startTagOrElement: { name: string; rawName: string }) {
        return getTagName(startTagOrElement, this.isSFC)
    }

    /**
     * Detect the namespace of the new element.
     * @param token The StartTag token to detect.
     * @returns The namespace of the new element.
     */
    //eslint-disable-next-line complexity
    private detectNamespace(token: StartTag): Namespace {
        const name = this.getTagName(token)
        let ns = this.namespace

        if (ns === NS.MathML || ns === NS.SVG) {
            const element = this.currentNode
            if (element.type === "VElement") {
                if (
                    element.namespace === NS.MathML &&
                    this.getTagName(element) === "annotation-xml" &&
                    name === "svg"
                ) {
                    return NS.SVG
                }
                if (
                    isHTMLIntegrationPoint(element, this.isSFC) ||
                    (isMathMLIntegrationPoint(element, this.isSFC) &&
                        name !== "mglyph" &&
                        name !== "malignmark")
                ) {
                    ns = NS.HTML
                }
            }
        }

        if (ns === NS.HTML) {
            if (name === "svg") {
                return NS.SVG
            }
            if (name === "math") {
                return NS.MathML
            }
        }

        if (name === "template") {
            const xmlns = token.attributes.find((a) => a.key.name === "xmlns")
            const value = xmlns && xmlns.value && xmlns.value.value

            if (value === NS.HTML || value === NS.MathML || value === NS.SVG) {
                return value
            }
        }

        return ns
    }

    /**
     * Close the current element if necessary.
     * @param token The start tag to check.
     */
    private closeCurrentElementIfNecessary(token: StartTag): void {
        const element = this.currentNode
        if (element.type !== "VElement") {
            return
        }
        const name = this.getTagName(token)
        const elementName = this.getTagName(element)

        if (elementName === "p" && HTML_NON_FHRASING_TAGS.has(name)) {
            this.popElementStack()
        }
        if (elementName === name && HTML_CAN_BE_LEFT_OPEN_TAGS.has(name)) {
            this.popElementStack()
        }
        if (DT_DD.test(elementName) && DT_DD.test(name)) {
            this.popElementStack()
        }
    }

    /**
     * Adjust and validate the given attribute node.
     * @param node The attribute node to handle.
     * @param namespace The current namespace.
     */
    private processAttribute(node: VAttribute, namespace: Namespace): void {
        if (this.needConvertToDirective(node)) {
            this.postProcessesForScript.push(
                (parserOptions, scriptParserOptions) => {
                    convertToDirective(
                        this.text,
                        parserOptions,
                        scriptParserOptions,
                        this.locationCalculator,
                        node,
                    )
                },
            )
            return
        }

        node.key.name = adjustAttributeName(node.key.name, namespace)
        const key = this.getTagName(node.key)
        const value = node.value && node.value.value

        if (key === "xmlns" && value !== namespace) {
            this.reportParseError(node, "x-invalid-namespace")
        } else if (key === "xmlns:xlink" && value !== NS.XLink) {
            this.reportParseError(node, "x-invalid-namespace")
        }
    }
    /**
     * Checks whether the given attribute node is need convert to directive.
     * @param node The node to check
     */
    private needConvertToDirective(node: VAttribute) {
        const element = node.parent.parent
        const tagName = this.getTagName(element)
        const attrName = this.getTagName(node.key)

        if (
            attrName === "generic" &&
            element.parent.type === "VDocumentFragment" &&
            isScriptSetupElement(element) &&
            isTSLang(element)
        ) {
            return true
        }
        const expressionEnabled =
            this.expressionEnabled ||
            (attrName === "v-pre" && !this.isInVPreElement)
        if (!expressionEnabled) {
            return false
        }
        return (
            DIRECTIVE_NAME.test(attrName) ||
            attrName === "slot-scope" ||
            (tagName === "template" && attrName === "scope")
        )
    }

    /**
     * Process the given template text token with a configured template tokenizer, based on language.
     * @param token The template text token to process.
     * @param templateTokenizerOption The template tokenizer option.
     */
    private processTemplateText(
        token: Text,
        templateTokenizerOption: string | CustomTemplateTokenizerConstructor,
    ): void {
        const TemplateTokenizer: CustomTemplateTokenizerConstructor =
            typeof templateTokenizerOption === "function"
                ? templateTokenizerOption
                : // eslint-disable-next-line @typescript-eslint/no-require-imports
                  require(templateTokenizerOption)
        const templateTokenizer = new TemplateTokenizer(
            token.value,
            this.text,
            {
                startingLine: token.loc.start.line,
                startingColumn: token.loc.start.column,
            },
        )

        // override this.tokenizer to forward expressionEnabled and state changes
        const rootTokenizer = this.tokenizer
        this.tokenizer = templateTokenizer

        let templateToken: IntermediateToken | null = null
        while ((templateToken = templateTokenizer.nextToken()) != null) {
            ;(this as any)[templateToken.type](templateToken)
        }

        this.tokenizer = rootTokenizer

        const index = sortedIndexBy(
            this.tokenizer.tokens,
            token,
            (x) => x.range[0],
        )
        const count =
            sortedLastIndexBy(this.tokenizer.tokens, token, (x) => x.range[1]) -
            index
        this.tokenizer.tokens.splice(index, count, ...templateTokenizer.tokens)
        this.tokenizer.comments.push(...templateTokenizer.comments)
        this.tokenizer.errors.push(...templateTokenizer.errors)
    }

    /**
     * Handle the start tag token.
     * @param token The token to handle.
     */
    //eslint-disable-next-line complexity
    protected StartTag(token: StartTag): void {
        debug("[html] StartTag %j", token)

        this.closeCurrentElementIfNecessary(token)

        const parent = this.currentNode
        const namespace = this.detectNamespace(token)
        const element: VElement = {
            type: "VElement",
            range: [token.range[0], token.range[1]],
            loc: { start: token.loc.start, end: token.loc.end },
            parent,
            name: adjustElementName(token.name, namespace),
            rawName: token.rawName,
            namespace,
            startTag: {
                type: "VStartTag",
                range: token.range,
                loc: token.loc,
                parent: DUMMY_PARENT,
                selfClosing: token.selfClosing,
                attributes: token.attributes,
            },
            children: [],
            endTag: null,
            variables: [],
        }
        const hasVPre =
            !this.isInVPreElement &&
            token.attributes.some((a) => this.getTagName(a.key) === "v-pre")

        // Disable expression if v-pre
        if (hasVPre) {
            this.expressionEnabled = false
        }

        // Setup relations.
        parent.children.push(element)
        element.startTag.parent = element
        for (const attribute of token.attributes) {
            attribute.parent = element.startTag
            this.processAttribute(attribute, namespace)
        }

        // Resolve references.
        this.postProcessesForScript.push(() => {
            for (const attribute of element.startTag.attributes) {
                if (attribute.directive) {
                    if (
                        attribute.key.argument != null &&
                        attribute.key.argument.type === "VExpressionContainer"
                    ) {
                        resolveReferences(attribute.key.argument)
                    }
                    if (attribute.value != null) {
                        resolveReferences(attribute.value)
                    }
                }
            }
        })

        // Check whether the self-closing is valid.
        const isVoid =
            namespace === NS.HTML &&
            HTML_VOID_ELEMENT_TAGS.has(this.getTagName(element))
        if (token.selfClosing && !isVoid && namespace === NS.HTML) {
            this.reportParseError(
                token,
                "non-void-html-element-start-tag-with-trailing-solidus",
            )
        }

        // Vue.js supports self-closing elements even if it's not one of void elements.
        if (token.selfClosing || isVoid) {
            this.expressionEnabled = !this.isInVPreElement
            return
        }

        // Push to stack.
        this.elementStack.push(element)
        if (hasVPre) {
            assert(this.vPreElement === null)
            this.vPreElement = element
        }
        this.namespace = namespace

        // Update the content type of this element.
        if (namespace === NS.HTML) {
            const elementName = this.getTagName(element)
            if (element.parent.type === "VDocumentFragment") {
                const langAttr = element.startTag.attributes.find(
                    (a) => !a.directive && a.key.name === "lang",
                ) as VAttribute | undefined
                const lang = langAttr?.value?.value

                if (elementName === "template") {
                    this.expressionEnabled = true
                    if (lang && lang !== "html") {
                        // It is not an HTML template.
                        this.tokenizer.state = "RAWTEXT"
                        this.expressionEnabled = false
                    }
                } else if (this.isSFC) {
                    // Element is Custom Block. e.g. <i18n>
                    // Referred to the Vue parser. See https://github.com/vuejs/vue-next/blob/cbaa3805064cb581fc2007cf63774c91d39844fe/packages/compiler-sfc/src/parse.ts#L127
                    if (!lang || lang !== "html") {
                        // Custom Block is not HTML.
                        this.tokenizer.state = "RAWTEXT"
                    }
                } else {
                    if (HTML_RCDATA_TAGS.has(elementName)) {
                        this.tokenizer.state = "RCDATA"
                    }
                    if (HTML_RAWTEXT_TAGS.has(elementName)) {
                        this.tokenizer.state = "RAWTEXT"
                    }
                }
            } else {
                if (HTML_RCDATA_TAGS.has(elementName)) {
                    this.tokenizer.state = "RCDATA"
                }
                if (HTML_RAWTEXT_TAGS.has(elementName)) {
                    this.tokenizer.state = "RAWTEXT"
                }
            }
        }
    }

    /**
     * Handle the end tag token.
     * @param token The token to handle.
     */
    protected EndTag(token: EndTag): void {
        debug("[html] EndTag %j", token)

        const i = findLastIndex(
            this.elementStack,
            (el) => el.name.toLowerCase() === token.name,
        )
        if (i === -1) {
            this.reportParseError(token, "x-invalid-end-tag")
            return
        }

        const element = this.elementStack[i]
        element.endTag = {
            type: "VEndTag",
            range: token.range,
            loc: token.loc,
            parent: element,
        }

        this.popElementStackUntil(i)
    }

    /**
     * Handle the text token.
     * @param token The token to handle.
     */
    protected Text(token: Text): void {
        debug("[html] Text %j", token)
        const parent = this.currentNode
        if (
            token.value &&
            parent.type === "VElement" &&
            parent.name === "template" &&
            parent.parent.type === "VDocumentFragment"
        ) {
            const langAttribute = parent.startTag.attributes.find(
                (a) => a.key.name === "lang",
            )
            const lang = (langAttribute?.value as VLiteral)?.value
            if (lang && lang !== "html") {
                const templateTokenizerOption =
                    this.baseParserOptions.templateTokenizer?.[lang]
                if (templateTokenizerOption) {
                    this.processTemplateText(token, templateTokenizerOption)
                    return
                }
            }
        }
        parent.children.push({
            type: "VText",
            range: token.range,
            loc: token.loc,
            parent,
            value: token.value,
        })
    }

    /**
     * Handle the text token.
     * @param token The token to handle.
     */
    protected Mustache(token: Mustache): void {
        debug("[html] Mustache %j", token)

        const parent = this.currentNode
        const container: VExpressionContainer = {
            type: "VExpressionContainer",
            range: token.range,
            loc: token.loc,
            parent,
            expression: null,
            references: [],
        }
        // Set relationship.
        parent.children.push(container)

        this.postProcessesForScript.push((parserOptions) => {
            processMustache(
                parserOptions,
                this.locationCalculator,
                container,
                token,
            )
            // Resolve references.
            resolveReferences(container)
        })
    }
}
