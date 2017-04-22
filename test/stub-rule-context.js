/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const EventEmitter = require("events")
const NodeEventGenerator = require("eslint/lib/util/node-event-generator")
const traverseNodes = require("../lib/traverse-nodes")

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

/**
 * The stub of RuleContext.
 */
class StubRuleContext {
    /**
     * Initialize this stub.
     * @param {string} text The source code of this context.
     * @param {ASTNode} ast The root node of AST of this context.
     */
    constructor(text, ast) {
        this.eslint = new EventEmitter()
        this.sourceCode = {text, ast}
    }

    /**
     * Get the stub of the source code object.
     * @returns {object} The stub of the source code object.
     */
    getSourceCode() {
        return this.sourceCode
    }

    /**
     * Do traverse this AST.
     * @returns {void}
     */
    traverseThisAst() {
        const generator = new NodeEventGenerator(this.eslint)
        traverseNodes(this.sourceCode.ast, generator)
    }
}

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

module.exports = StubRuleContext
