const assert = require('assert')

module.exports = class CustomTokenizer {
    constructor (text, code, { startingLine, startingColumn }) {
        // set initial tokenizer states used by the parser
        this.expressionEnabled = true
        this.namespace = "http://www.w3.org/1999/xhtml"
        this.text = code
        // ignore actual input and just hardcode tokens
        assert.equal(startingLine, 1)
        assert.equal(startingColumn, 28)
        this.line = startingLine
        this.column = startingColumn
        this.offset = 28
        this.tokens = [
            this.generateToken("\n    ", {
                type: "CustomWhitespace"
            }),
            this.generateToken("A-totally", {
                type: "CustomTagOpen",
                value: "A-totally"
            }),
            this.generateToken(":made", {
                type: "CustomIdentifier"
            }),
            this.generateToken("=", {
                type: "CustomAssociation",
                value: ""
            }),
            this.generateToken("\"up\"", {
                type: "CustomLiteral",
                value: "up"
            }),
            this.generateToken("]", {
                type: "CustomTagClose",
                value: ""
            }),
            this.generateToken("%%%", {
                type: "VExpressionStart"
            }),
            this.generateToken(" templating + language ", {
                type: "CustomText"
            }),
            this.generateToken("%%%", {
                type: "VExpressionEnd"
            }),
            this.generateToken("", {
                type: "CustomEndTag"
            }),
            this.generateToken("<=== comment ===>", {
                type: "CustomComment",
                value: "comment"
            })
        ]
        this.comments = this.tokens.filter(token => token.type === "CustomComment")
        this.tokens = this.tokens.filter(token => token.type !== "CustomComment")

        this.errors = [{
            "message": "totally-made-up-error",
            "index": 9001,
            "lineNumber": 15,
            "column": 8
        }]

        const attribute = {
            type: "VAttribute",
            parent: {},
            directive: false,
            range: [this.tokens[2].range[0], this.tokens[4].range[1]],
            loc: {
                start: this.tokens[2].start,
                end: this.tokens[4].end
            }
        }

        attribute.key = {
            type: "VIdentifier",
            parent: attribute,
            name: ":made",
            rawName: ":made",
            range: this.tokens[2].range,
            loc: this.tokens[2].loc
        }

        attribute.value = {
            type: "VLiteral",
            parent: attribute,
            value: "up",
            range: this.tokens[4].range,
            loc: this.tokens[4].loc
        }

        // these tokens get returned by nextToken
        const intermediateTokens = [{
            type: "StartTag",
            name: "a-totally",
            rawName: "A-totally",
            range: [this.tokens[1].range[0], this.tokens[5].range[1]],
            loc: {
                start: this.tokens[1].loc.start,
                end: this.tokens[5].loc.end
            },
            selfClosing: false,
            attributes: [attribute]
        }, {
            type: "Mustache",
            value: " templating + language ",
            range: [this.tokens[6].range[0], this.tokens[8].range[1]],
            loc: {
                start: this.tokens[6].loc.start,
                end: this.tokens[8].loc.end
            },
            startToken: this.tokens[6],
            endToken: this.tokens[8]
        }, {
            type: "EndTag",
            name: "a-totally",
            range: this.tokens[9].range,
            loc: this.tokens[9].loc,
        }]
        this.tokenIterator = intermediateTokens[Symbol.iterator]()
    }

    nextToken () {
        return this.tokenIterator.next().value
    }

    // set range and loc based on text length and current offset
    generateToken (text, data) {
        const skip = this.text.indexOf(text, this.offset) - this.offset
        const range = [this.offset + skip, this.offset + skip + text.length]
        this.offset = range[1]
        const loc = {
            start: {
                line: this.line,
                column: this.column + skip
            }
        }
        this.line += text.split('\n').length - 1
        this.column = text.split('\n').length - 1 ? text.length - text.lastIndexOf('\n') - 1 : this.column + skip + text.length
        loc.end = {
            line: this.line,
            column: this.column
        }
        return {
            range,
            loc,
            value: text,
            ...data
        }
    }
}
