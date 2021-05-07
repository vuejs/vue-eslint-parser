// -----------------------------------------------------------------------------
// Requirements
// -----------------------------------------------------------------------------
import * as utils from "./"

// ------------------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------------------

type CommentParserConfig = {
    exceptions?: string[]
}

type HTMLCommentVisitor = (comment: ParsedHTMLComment) => void

type CommentVisitorOption = {
    includeDirectives?: boolean
}

type HTMLCommentOpen = Token & { type: "HTMLCommentOpen" }
type HTMLCommentOpenDecoration = Token & { type: "HTMLCommentOpenDecoration" }
type HTMLCommentValue = Token & { type: "HTMLCommentValue" }
type HTMLCommentClose = Token & { type: "HTMLCommentClose" }
type HTMLCommentCloseDecoration = Token & { type: "HTMLCommentCloseDecoration" }
type ParsedHTMLComment = {
    open: HTMLCommentOpen
    openDecoration: HTMLCommentOpenDecoration | null
    value: HTMLCommentValue | null
    closeDecoration: HTMLCommentCloseDecoration | null
    close: HTMLCommentClose
}

// eslint-disable-next-line require-unicode-regexp
const COMMENT_DIRECTIVE = /^\s*eslint-(?:en|dis)able/
// eslint-disable-next-line require-unicode-regexp
const IE_CONDITIONAL_IF = /^\[if\s+/
// eslint-disable-next-line require-unicode-regexp
const IE_CONDITIONAL_ENDIF = /\[endif\]$/

const TYPE_HTML_COMMENT_OPEN: "HTMLCommentOpen" = "HTMLCommentOpen"
const TYPE_HTML_COMMENT_OPEN_DECORATION: "HTMLCommentOpenDecoration" =
    "HTMLCommentOpenDecoration"
const TYPE_HTML_COMMENT_VALUE: "HTMLCommentValue" = "HTMLCommentValue"
const TYPE_HTML_COMMENT_CLOSE: "HTMLCommentClose" = "HTMLCommentClose"
const TYPE_HTML_COMMENT_CLOSE_DECORATION: "HTMLCommentCloseDecoration" =
    "HTMLCommentCloseDecoration"

function isCommentDirective(comment: HTMLComment) {
    return COMMENT_DIRECTIVE.test(comment.value)
}

function isIEConditionalComment(comment: HTMLComment) {
    return (
        IE_CONDITIONAL_IF.test(comment.value) ||
        // eslint-disable-next-line @mysticatea/ts/prefer-string-starts-ends-with
        IE_CONDITIONAL_ENDIF.test(comment.value)
    )
}

/**
 * Define HTML comment parser
 *
 * @param sourceCode The source code instance.
 * @param config The config.
 * @returns HTML comment parser.
 */
function defineParser(
    sourceCode: SourceCode,
    config: CommentParserConfig | null,
): (node: Token) => ParsedHTMLComment | null {
    // eslint-disable-next-line no-param-reassign
    config = config || {}

    const exceptions = config.exceptions || []

    /**
     * Get a open decoration string from comment contents.
     * @param contents comment contents
     * @returns decoration string
     */
    function getOpenDecoration(contents: string) {
        let decoration = ""
        for (const exception of exceptions) {
            const length = exception.length
            let index = 0
            while (contents.startsWith(exception, index)) {
                index += length
            }
            const exceptionLength = index
            if (decoration.length < exceptionLength) {
                decoration = contents.slice(0, exceptionLength)
            }
        }
        return decoration
    }

    /**
     * Get a close decoration string from comment contents.
     * @param contents comment contents
     * @returns decoration string
     */
    function getCloseDecoration(contents: string) {
        let decoration = ""
        for (const exception of exceptions) {
            const length = exception.length
            let index = contents.length
            while (contents.endsWith(exception, index)) {
                index -= length
            }
            const exceptionLength = contents.length - index
            if (decoration.length < exceptionLength) {
                decoration = contents.slice(index)
            }
        }
        return decoration
    }

    /**
     * Parse HTMLComment.
     * @param {ASTToken} node a comment token
     * @returns {HTMLComment | null} the result of HTMLComment tokens.
     */
    return function parseHTMLComment(node: Token): ParsedHTMLComment | null {
        if (node.type !== "HTMLComment") {
            // Is not HTMLComment
            return null
        }

        const htmlCommentText = sourceCode.getText(node)

        if (
            !htmlCommentText.startsWith("<!--") ||
            !htmlCommentText.endsWith("-->")
        ) {
            // Is not normal HTML Comment
            // e.g. Error Code: "abrupt-closing-of-empty-comment", "incorrectly-closed-comment"
            return null
        }

        let valueText = htmlCommentText.slice(4, -3)
        const openDecorationText = getOpenDecoration(valueText)
        valueText = valueText.slice(openDecorationText.length)
        // eslint-disable-next-line require-unicode-regexp
        const firstCharIndex = valueText.search(/\S/)
        const beforeSpace =
            firstCharIndex >= 0 ? valueText.slice(0, firstCharIndex) : valueText
        valueText = valueText.slice(beforeSpace.length)

        const closeDecorationText = getCloseDecoration(valueText)
        if (closeDecorationText) {
            valueText = valueText.slice(0, -closeDecorationText.length)
        }
        // eslint-disable-next-line require-unicode-regexp
        const lastCharIndex = valueText.search(/\S\s*$/)
        const afterSpace =
            lastCharIndex >= 0 ? valueText.slice(lastCharIndex + 1) : valueText
        if (afterSpace) {
            valueText = valueText.slice(0, -afterSpace.length)
        }

        let tokenIndex = node.range[0]
        /**
         * @param type
         * @param value
         * @returns {any}
         */
        const createToken = (type: string, value: string): any => {
            const range: Range = [tokenIndex, tokenIndex + value.length]
            tokenIndex = range[1]

            let loc: SourceLocation
            return {
                type,
                value,
                range,
                get loc() {
                    if (loc) {
                        return loc
                    }
                    return (loc = {
                        start: sourceCode.getLocFromIndex(range[0]),
                        end: sourceCode.getLocFromIndex(range[1]),
                    })
                },
            }
        }

        const open: HTMLCommentOpen = createToken(
            TYPE_HTML_COMMENT_OPEN,
            "<!--",
        )
        const openDecoration: HTMLCommentOpenDecoration | null = openDecorationText
            ? createToken(TYPE_HTML_COMMENT_OPEN_DECORATION, openDecorationText)
            : null
        tokenIndex += beforeSpace.length
        const value: HTMLCommentValue | null = valueText
            ? createToken(TYPE_HTML_COMMENT_VALUE, valueText)
            : null
        tokenIndex += afterSpace.length
        const closeDecoration: HTMLCommentCloseDecoration | null = closeDecorationText
            ? createToken(
                  TYPE_HTML_COMMENT_CLOSE_DECORATION,
                  closeDecorationText,
              )
            : null
        const close: HTMLCommentClose = createToken(
            TYPE_HTML_COMMENT_CLOSE,
            "-->",
        )

        return {
            /** HTML comment open (`<!--`) */
            open,
            /** decoration of the start of HTML comments. (`*****` when `<!--*****`) */
            openDecoration,
            /** value of HTML comment. whitespaces and other tokens are not included. */
            value,
            /** decoration of the end of HTML comments.  (`*****` when `*****-->`) */
            closeDecoration,
            /** HTML comment close (`-->`) */
            close,
        }
    }
}

/**
 * Define HTML comment visitor
 *
 * @param context The rule context.
 * @param config The config.
 * @param visitHTMLComment The HTML comment visitor.
 * @param [visitorOption] The option for visitor.
 * @returns HTML comment visitor.
 */
export function defineVisitor(
    context: RuleContext,
    config: CommentParserConfig | null,
    visitHTMLComment: HTMLCommentVisitor,
    visitorOption: CommentVisitorOption,
): RuleListener {
    return {
        Program(node) {
            // eslint-disable-next-line no-param-reassign
            visitorOption = visitorOption || {}
            if (utils.hasInvalidEOF(node)) {
                return
            }
            if (!node.templateBody) {
                return
            }
            const parse = defineParser(context.getSourceCode(), config)

            for (const comment of node.templateBody.comments) {
                if (comment.type !== "HTMLComment") {
                    continue
                }
                if (
                    !visitorOption.includeDirectives &&
                    isCommentDirective(comment)
                ) {
                    // ignore directives
                    continue
                }
                if (isIEConditionalComment(comment)) {
                    // ignore IE conditional
                    continue
                }

                const tokens = parse(comment)
                if (tokens) {
                    visitHTMLComment(tokens)
                }
            }
        },
    }
}
