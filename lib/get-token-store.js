/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */
"use strict"

//------------------------------------------------------------------------------
// Requirements
//------------------------------------------------------------------------------

const TokenStore = require("eslint/lib/token-store")

//------------------------------------------------------------------------------
// Helpers
//------------------------------------------------------------------------------

const stores = new WeakMap()

/**
 * Get the token store of the template body.
 * @param {RuleContext} context The rule context to get.
 * @returns {TokenStore} The token store of template body.
 */
function getTokenStore(context) {
    const ast = context.getSourceCode().ast.templateBody
    if (stores.has(ast)) {
        return stores.get(ast)
    }
    const store = (ast != null)
        ? new TokenStore(ast.tokens, ast.comments)
        : new TokenStore([], [])

    stores.set(ast, store)
    return store
}

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

module.exports = getTokenStore
