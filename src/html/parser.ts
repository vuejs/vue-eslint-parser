/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
import * as lodash from "lodash"
import {debug} from "../common/debug"
import {ErrorCode, Namespace, NS, ParseError, Token, VAttribute, VDocumentFragment, VElement, VNode, VText} from "../ast"
import {MATHML_ATTRIBUTE_NAME_MAP, SVG_ATTRIBUTE_NAME_MAP} from "./util/attribute-names"
import {HTML_CAN_BE_LEFT_OPEN_TAGS, HTML_NON_FHRASING_TAGS, HTML_VOID_ELEMENT_TAGS, SVG_ELEMENT_NAME_MAP} from "./util/tag-names"
import {Tokenizer, TokenType} from "./tokenizer"

/**
 * Check whether the element is a MathML text integration point or not.
 * @see https://html.spec.whatwg.org/multipage/parsing.html#tree-construction-dispatcher
 * @param element The current element.
 * @returns `true` if the element is a MathML text integration point.
 */
function isMathMLIntegrationPoint(element: VElement): boolean {
    if (element.namespace === NS.MathML) {
        const name = element.name
        return name === "mi" || name === "mo" || name === "mn" || name === "ms" || name === "mtext"
    }
    return false
}

/**
 * Check whether the element is a HTML integration point or not.
 * @see https://html.spec.whatwg.org/multipage/parsing.html#tree-construction-dispatcher
 * @param element The current element.
 * @returns `true` if the element is a HTML integration point.
 */
function isHTMLIntegrationPoint(element: VElement): boolean {
    if (element.namespace === NS.MathML) {
        return (
            element.name === "annotation-xml" &&
            element.startTag.attributes.some(a =>
                a.directive === false &&
                a.key.name === "encoding" &&
                a.value != null &&
                (
                    a.value.value === "text/html" ||
                    a.value.value === "application/xhtml+xml"
                )
            )
        )
    }
    if (element.namespace === NS.SVG) {
        const name = element.name
        return name === "foreignObject" || name === "desc" || name === "title"
    }

    return false
}

/**
 * The parser of HTML.
 * This is not following to the HTML spec completely because Vue.js template spec is pretty different to HTML.
 */
export class Parser {
    private tokenizer: Tokenizer
    private tokens: Token[]
    private comments: Token[]
    private currentNode: VNode
    private nodeStack: VNode[]
    private namespaceStack: VElement[]

    /**
     * Initialize this parser.
     * @param tokenizer The tokenizer to parse.
     * @param postprocess The callback function to postprocess nodes.
     */
    constructor(tokenizer: Tokenizer) {
        this.tokenizer = tokenizer
        this.tokens = []
        this.comments = []
        this.currentNode = {
            type: "VDocumentFragment",
            range: [0, 0],
            loc: {
                start: {line: 1, column: 0},
                end: {line: 1, column: 0},
            },
            parent: null,
            children: [],
            tokens: this.tokens,
            comments: this.comments,
            errors: this.tokenizer.errors,
        }
        this.nodeStack = []
        this.namespaceStack = []
    }

    /**
     * The syntax errors which are found in this parsing.
     */
    get errors(): ParseError[] {
        return this.tokenizer.errors
    }

    /**
     * The current namespace.
     */
    get namespace(): Namespace {
        return this.tokenizer.namespace
    }
    set namespace(value: Namespace) { //eslint-disable-line require-jsdoc
        this.tokenizer.namespace = value
    }

    /**
     * Parse the HTML which was given in this constructor.
     * @returns The result of parsing.
     */
    parse(): VDocumentFragment {
        let token: Token
        while ((token = this.tokenizer.nextToken()).type !== "EOF") {
            this[token.type as TokenType](token)
        }

        while (this.nodeStack.length >= 1) {
            this.popNodeStack()
        }

        debug("[html] GAP = %j", this.tokenizer.gaps)
        debug("[html] LT  = %j", this.tokenizer.lineTerminators)

        return this.currentNode as VDocumentFragment
    }

    /**
     * Report an invalid character error.
     * @param code The error code.
     */
    private reportParseError(token: Token, code: ErrorCode): void {
        const error = ParseError.fromCode(code, token.range[0], token.loc.start.line, token.loc.start.column)
        this.errors.push(error)

        debug("[html] syntax error:", error.message)
    }

    /**
     * Push the given node to the current node stack.
     * @param node The node to push.
     */
    private pushNodeStack(node: VNode): void {
        debug("[html] push node: %s", node.type)

        this.nodeStack.push(this.currentNode)
        this.currentNode = node

        // Update the current namespace.
        if (node.type === "VElement" && node.namespace !== this.namespace) {
            this.namespaceStack.push(node)
            this.namespace = node.namespace
        }
    }

    /**
     * Pop a node from the current node stack.
     */
    private popNodeStack(): void {
        debug("[html] pop node: %s %j", this.currentNode.type, this.currentNode.range)

        const node = this.currentNode
        const poppedNode = this.nodeStack.pop()
        if (poppedNode == null) {
            throw new Error("unreachable")
        }

        poppedNode.range[1] = node.range[1]
        poppedNode.loc.end = node.loc.end

        this.currentNode = poppedNode

        // Update the current namespace.
        if (node === lodash.last(this.namespaceStack)) {
            this.namespaceStack.pop()

            const namespaceElement = lodash.last(this.namespaceStack)
            if (namespaceElement != null) {
                this.namespace = namespaceElement.namespace
            }
            else {
                this.namespace = NS.HTML
            }
        }
    }

    /**
     * Adjust element names by the current namespace.
     * @param name The lowercase element name to adjust.
     * @returns The adjusted element name.
     */
    private adjustElementName(name: string): string {
        if (this.namespace === NS.SVG) {
            return SVG_ELEMENT_NAME_MAP.get(name) || name
        }
        return name
    }

    /**
     * Adjust attribute names by the current namespace.
     * @param name The lowercase attribute name to adjust.
     * @returns The adjusted attribute name.
     */
    private adjustAttributeName(name: string): string {
        if (this.namespace === NS.SVG) {
            return SVG_ATTRIBUTE_NAME_MAP.get(name) || name
        }
        if (this.namespace === NS.MathML) {
            return MATHML_ATTRIBUTE_NAME_MAP.get(name) || name
        }
        return name
    }

    /**
     * Get the current element.
     * @returns The current element.
     */
    private getCurrentElement(): VElement | undefined {
        if (this.currentNode != null && this.currentNode.type === "VElement") {
            return this.currentNode
        }

        for (let i = this.nodeStack.length - 1; i >= 0; --i) {
            const node = this.nodeStack[i]
            if (node.type === "VElement") {
                return node
            }
        }

        return undefined
    }

    /**
     * Detect the namespace of the new element.
     * @param name The value of a HTMLTagOpen token.
     * @returns The namespace of the new element.
     */
    private detectNamespace(name: string): Namespace {
        let ns = this.namespace

        if (ns === NS.MathML || ns === NS.SVG) {
            const element = this.getCurrentElement()
            if (element != null) {
                if (element.namespace === NS.MathML && element.name === "annotation-xml" && name === "svg") {
                    return NS.SVG
                }
                if (isHTMLIntegrationPoint(element) || (isMathMLIntegrationPoint(element) && name !== "mglyph" && name !== "malignmark")) {
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

        return ns
    }

    /**
     * Check whether the given tag name is valid as a end tag.
     * @param name The tag name to check.
     * @returns `true` if an element which has the name is opened.
     */
    private isValidEndTag(name: string): boolean {
        if (this.currentNode != null && this.currentNode.type === "VElement" && this.currentNode.name === name) {
            return true
        }
        return this.nodeStack.some(node =>
            node.type === "VElement" && node.name === name
        )
    }

    /**
     * Process the given comment token.
     * @param token The comment token to process.
     */
    private processComment(token: Token): void {
        this.comments.push(token)
    }

    /**
     * Process the given text token.
     * @param token The text token to process.
     */
    private processText(token: Token): void {
        this.tokens.push(token)

        while (
            this.currentNode.type !== "VText" &&
            this.currentNode.type !== "VElement" &&
            this.currentNode.type !== "VDocumentFragment"
        ) {
            this.popNodeStack()
        }

        if (this.currentNode.type === "VText") {
            if (this.currentNode.range[1] === token.range[0]) {
                this.currentNode.value += token.value
                this.currentNode.range[1] = token.range[1]
                this.currentNode.loc.end = token.loc.end
                return
            }

            this.popNodeStack()
            if (this.currentNode.type === "VText") {
                throw new Error("unreachable")
            }
        }

        const parentElement = this.currentNode
        const text: VText = {
            type: "VText",
            range: [token.range[0], token.range[1]],
            loc: {start: token.loc.start, end: token.loc.end},
            parent: parentElement,
            value: token.value,
        }
        parentElement.children.push(text)

        this.pushNodeStack(text)
    }

    /**
     * Close the current element if necessary.
     * @param name The tag name to check.
     */
    private closeCurrentElementIfNecessary(name: string): void {
        if (this.currentNode.type === "VText") {
            this.popNodeStack()
        }

        const element = this.currentNode
        if (element.type !== "VElement") {
            return
        }

        if (element.name === "p" && HTML_NON_FHRASING_TAGS.has(name)) {
            this.popNodeStack()
        }
        if (element.name === name && HTML_CAN_BE_LEFT_OPEN_TAGS.has(name)) {
            this.popNodeStack()
        }
    }

    /**
     * Process an EOF token.
     * @param token The token to process.
     */
    protected EOF(_token: Token): void { //eslint-disable-line class-methods-use-this
        throw new Error("never called")
    }

    /**
     * Process a HTMLAssociation token.
     * @param token The token to process.
     */
    protected HTMLAssociation(token: Token): void {
        this.tokens.push(token)

        const attribute = this.currentNode
        if (attribute.type === "VAttribute") {
            attribute.range[1] = token.range[1]
            attribute.loc.end = token.loc.end
        }
    }

    /**
     * Process a HTMLBogusComment token.
     * @param token The token to process.
     */
    protected HTMLBogusComment(token: Token): void {
        this.processComment(token)
    }

    /**
     * Process a HTMLCDataText token.
     * @param token The token to process.
     */
    protected HTMLCDataText(token: Token): void {
        this.processText(token)
    }

    /**
     * Process a HTMLComment token.
     * @param token The token to process.
     */
    protected HTMLComment(token: Token): void {
        this.processComment(token)
    }

    /**
     * Process a HTMLEndTagOpen token.
     * @param token The token to process.
     */
    protected HTMLEndTagOpen(token: Token): void {
        this.tokens.push(token)

        // Check whether this is a valid end tag.
        if (!this.isValidEndTag(token.value)) {
            this.reportParseError(token, "x-invalid-end-tag")
            return
        }

        // Pop until the correspond element.
        while (this.currentNode.type !== "VElement" || this.currentNode.name !== token.value) {
            this.popNodeStack()
        }

        // Push the end tag.
        const element = this.currentNode
        element.endTag = {
            type: "VEndTag",
            range: [token.range[0], token.range[1]],
            loc: {start: token.loc.start, end: token.loc.end},
            parent: element,
        }

        this.pushNodeStack(element.endTag)
    }

    /**
     * Process a HTMLIdentifier token.
     * @param token The token to process.
     */
    protected HTMLIdentifier(token: Token): void {
        this.tokens.push(token)

        if (this.currentNode.type === "VAttribute") {
            this.popNodeStack()
        }

        const startTag = this.currentNode
        if (startTag.type === "VEndTag") {
            this.reportParseError(token, "end-tag-with-attributes")
            return
        }
        if (startTag.type !== "VStartTag") {
            throw new Error("unreachable")
        }

        const attribute: VAttribute = {
            type: "VAttribute",
            range: [token.range[0], token.range[1]],
            loc: {start: token.loc.start, end: token.loc.end},
            parent: startTag,
            directive: false,
            key: {
                type: "VIdentifier",
                range: [token.range[0], token.range[1]],
                loc: {start: token.loc.start, end: token.loc.end},
                parent: {} as VAttribute,
                name: this.adjustAttributeName(token.value),
            },
            value: null,
        }
        attribute.key.parent = attribute
        startTag.attributes.push(attribute)

        this.pushNodeStack(attribute)
    }

    /**
     * Process a HTMLLiteral token.
     * @param token The token to process.
     */
    protected HTMLLiteral(token: Token): void {
        this.tokens.push(token)

        const attribute = this.currentNode
        if (attribute.type !== "VAttribute" || attribute.directive === true) {
            throw new Error("unreachable")
        }

        // Check namespace
        if (attribute.key.name === "xmlns" && token.value !== this.namespace) {
            this.reportParseError(token, "x-invalid-namespace")
        }
        if (attribute.key.name === "xmlns:xlink" && token.value !== NS.XLink) {
            this.reportParseError(token, "x-invalid-namespace")
        }

        // Initialize the attribute value.
        attribute.range[1] = token.range[1]
        attribute.loc.end = token.loc.end
        attribute.value = {
            type: "VLiteral",
            range: [token.range[0], token.range[1]],
            loc: {start: token.loc.start, end: token.loc.end},
            parent: attribute,
            value: token.value,
        }
    }

    /**
     * Process a HTMLRCDataText token.
     * @param token The token to process.
     */
    protected HTMLRCDataText(token: Token): void {
        this.processText(token)
    }

    /**
     * Process a HTMLRawText token.
     * @param token The token to process.
     */
    protected HTMLRawText(token: Token): void {
        this.processText(token)
    }

    /**
     * Process a HTMLSelfClosingTagClose token.
     * @param token The token to process.
     */
    protected HTMLSelfClosingTagClose(token: Token): void {
        this.tokens.push(token)

        if (this.currentNode.type === "VAttribute") {
            this.popNodeStack()
        }

        if (this.currentNode.type === "VEndTag") {
            this.reportParseError(token, "end-tag-with-trailing-solidus")
        }
        else if (this.currentNode.type === "VStartTag") {
            const element = this.currentNode.parent
            if (!HTML_VOID_ELEMENT_TAGS.has(element.name)) {
                this.reportParseError(token, "non-void-html-element-start-tag-with-trailing-solidus")
            }
        }
        else {
            return
        }

        const tag = this.currentNode
        tag.range[1] = token.range[1]
        tag.loc.end = token.loc.end

        // Pop the start/end tag.
        this.popNodeStack()
        // Pop the element. Note Vue.js supports self-closing start tags.
        this.popNodeStack()
    }

    /**
     * Process a HTMLTagClose token.
     * @param token The token to process.
     */
    protected HTMLTagClose(token: Token): void {
        this.tokens.push(token)

        if (this.currentNode.type === "VAttribute") {
            this.popNodeStack()
        }
        if (this.currentNode.type !== "VStartTag" && this.currentNode.type !== "VEndTag") {
            return
        }

        const tag = this.currentNode
        tag.range[1] = token.range[1]
        tag.loc.end = token.loc.end

        // Pop the start/end tag.
        this.popNodeStack()
        // Pop the element if it's a end tag.
        if (tag.type === "VEndTag" || HTML_VOID_ELEMENT_TAGS.has(tag.parent.name)) {
            this.popNodeStack()
        }
    }

    /**
     * Process a HTMLTagOpen token.
     * @param token The token to process.
     */
    protected HTMLTagOpen(token: Token): void {
        this.tokens.push(token)

        this.closeCurrentElementIfNecessary(token.value)

        const parentElement = this.currentNode
        if (parentElement.type !== "VElement" && parentElement.type !== "VDocumentFragment") {
            throw new Error("unreachable")
        }

        const element: VElement = {
            type: "VElement",
            range: [token.range[0], token.range[1]],
            loc: {start: token.loc.start, end: token.loc.end},
            parent: parentElement,
            name: this.adjustElementName(token.value),
            namespace: this.detectNamespace(token.value),
            startTag: {
                type: "VStartTag",
                range: [token.range[0], token.range[1]],
                loc: {start: token.loc.start, end: token.loc.end},
                parent: {} as VElement,
                attributes: [],
            },
            children: [],
            endTag: null,
            variables: [],
        }
        element.startTag.parent = element
        parentElement.children.push(element)

        this.pushNodeStack(element)
        this.pushNodeStack(element.startTag)
    }

    /**
     * Process a HTMLText token.
     * @param token The token to process.
     */
    protected HTMLText(token: Token): void {
        this.processText(token)
    }

    /**
     * Process a HTMLWhitespace token.
     * @param token The token to process.
     */
    protected HTMLWhitespace(token: Token): void {
        this.processText(token)
    }

    /**
     * Process a VExpressionStart token.
     * @param token The token to process.
     */
    protected VExpressionStart(token: Token): void {
        this.processText(token)
    }

    /**
     * Process a VExpressionEnd token.
     * @param token The token to process.
     */
    protected VExpressionEnd(token: Token): void {
        this.processText(token)
    }
}
