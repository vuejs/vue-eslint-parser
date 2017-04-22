/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const ScopeAnalyzer = require("eslint-scope")

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const OPTS = {ignoreEval: true, ecmaVersion: 8}

/**
 * Analyze the external references of the given AST.
 * @param {ASTNode} ast The root node to analyze.
 * @returns {Reference[]} The reference objects of external references.
 */
function analyzeReferences(ast) {
    const result = ScopeAnalyzer.analyze(ast, OPTS)
    const scope = result.acquire(ast)
    const references = scope.through

    return references.map(r => ({
        id: r.identifier,
        mode: (
            r.isReadOnly() ? "r" :
            r.isWriteOnly() ? "w" :
            /* otherwise */ "rw"
        ),
    }))
}

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

module.exports = analyzeReferences
