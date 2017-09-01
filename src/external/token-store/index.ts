/**
 * @fileoverview Object to handle access and retrieval of tokens.
 * @author Brandon Mills
 */
import assert from "assert"
import {HasLocation, Token} from "../../ast"
import * as cursors from "./cursors"
import Cursor from "./cursors/cursor"
import ForwardTokenCursor from "./cursors/forward-token-cursor"
import PaddedTokenCursor from "./cursors/padded-token-cursor"
import {search} from "./utils"

export type SkipOptions = number | ((token: Token) => boolean) | {
    includeComments?: boolean
    filter?: (token: Token) => boolean
    skip?: number
}
export type CountOptions = number | ((token: Token) => boolean) | {
    includeComments?: boolean
    filter?: (token: Token) => boolean
    count?: number
}

/**
 * Check whether the given token is a comment token or not.
 * @param token The token to check.
 * @returns `true` if the token is a comment token.
 */
function isCommentToken(token: Token): boolean {
    return token.type === "Line" || token.type === "Block" || token.type === "Shebang"
}

/**
 * Creates the map from locations to indices in `tokens`.
 *
 * The first/last location of tokens is mapped to the index of the token.
 * The first/last location of comments is mapped to the index of the next token of each comment.
 *
 * @param tokens - The array of tokens.
 * @param comments - The array of comments.
 * @returns The map from locations to indices in `tokens`.
 * @private
 */
function createIndexMap(tokens: Token[], comments: Token[]): { [key: number]: number } {
    const map = Object.create(null)
    let tokenIndex = 0
    let commentIndex = 0
    let nextStart = 0
    let range: [number, number] | null = null

    while (tokenIndex < tokens.length || commentIndex < comments.length) {
        nextStart = (commentIndex < comments.length) ? comments[commentIndex].range[0] : Number.MAX_SAFE_INTEGER
        while (tokenIndex < tokens.length && (range = tokens[tokenIndex].range)[0] < nextStart) {
            map[range[0]] = tokenIndex
            map[range[1] - 1] = tokenIndex
            tokenIndex += 1
        }

        nextStart = (tokenIndex < tokens.length) ? tokens[tokenIndex].range[0] : Number.MAX_SAFE_INTEGER
        while (commentIndex < comments.length && (range = comments[commentIndex].range)[0] < nextStart) {
            map[range[0]] = tokenIndex
            map[range[1] - 1] = tokenIndex
            commentIndex += 1
        }
    }

    return map
}

/**
 * Creates the cursor iterates tokens with options.
 *
 * @param factory - The cursor factory to initialize cursor.
 * @param tokens - The array of tokens.
 * @param comments - The array of comments.
 * @param indexMap - The map from locations to indices in `tokens`.
 * @param startLoc - The start location of the iteration range.
 * @param endLoc - The end location of the iteration range.
 * @param opts - The option object. If this is a number then it's `opts.skip`. If this is a function then it's `opts.filter`.
 * @returns The created cursor.
 * @private
 */
function createCursorWithSkip(factory: cursors.CursorFactory, tokens: Token[], comments: Token[], indexMap: { [key: number]: number }, startLoc: number, endLoc: number, opts?: SkipOptions): Cursor {
    let includeComments = false
    let skip = 0
    let filter: ((token: Token) => boolean) | null = null

    if (typeof opts === "number") {
        skip = opts | 0
    }
    else if (typeof opts === "function") {
        filter = opts
    }
    else if (opts) {
        includeComments = Boolean(opts.includeComments)
        skip = opts.skip || 0
        filter = opts.filter || null
    }
    assert(skip >= 0, "options.skip should be zero or a positive integer.")
    assert(!filter || typeof filter === "function", "options.filter should be a function.")

    return factory.createCursor(tokens, comments, indexMap, startLoc, endLoc, includeComments, filter, skip, -1)
}

/**
 * Creates the cursor iterates tokens with options.
 *
 * @param factory - The cursor factory to initialize cursor.
 * @param tokens - The array of tokens.
 * @param comments - The array of comments.
 * @param indexMap - The map from locations to indices in `tokens`.
 * @param startLoc - The start location of the iteration range.
 * @param endLoc - The end location of the iteration range.
 * @param opts - The option object. If this is a number then it's `opts.count`. If this is a function then it's `opts.filter`.
 * @returns The created cursor.
 * @private
 */
function createCursorWithCount(factory: cursors.CursorFactory, tokens: Token[], comments: Token[], indexMap: { [key: number]: number }, startLoc: number, endLoc: number, opts?: CountOptions): Cursor {
    let includeComments = false
    let count = 0
    let countExists = false
    let filter: ((token: Token) => boolean) | null = null

    if (typeof opts === "number") {
        count = opts | 0
        countExists = true
    }
    else if (typeof opts === "function") {
        filter = opts
    }
    else if (opts) {
        includeComments = Boolean(opts.includeComments)
        count = opts.count || 0
        countExists = typeof opts.count === "number"
        filter = opts.filter || null
    }
    assert(count >= 0, "options.count should be zero or a positive integer.")
    assert(!filter || typeof filter === "function", "options.filter should be a function.")

    return factory.createCursor(tokens, comments, indexMap, startLoc, endLoc, includeComments, filter, 0, countExists ? count : -1)
}

/**
 * Creates the cursor iterates tokens with options.
 *
 * @param tokens - The array of tokens.
 * @param comments - The array of comments.
 * @param indexMap - The map from locations to indices in `tokens`.
 * @param startLoc - The start location of the iteration range.
 * @param endLoc - The end location of the iteration range.
 * @param beforeCount - The number of tokens before the node to retrieve.
 * @param afterCount - The number of tokens after the node to retrieve.
 * @returns The created cursor.
 * @private
 */
function createCursorWithPadding(tokens: Token[], comments: Token[], indexMap: { [key: number]: number }, startLoc: number, endLoc: number, beforeCount?: CountOptions, afterCount?: number): Cursor {
    if (typeof beforeCount === "undefined" && typeof afterCount === "undefined") {
        return new ForwardTokenCursor(tokens, comments, indexMap, startLoc, endLoc)
    }
    if (typeof beforeCount === "number" || typeof beforeCount === "undefined") {
        return new PaddedTokenCursor(tokens, comments, indexMap, startLoc, endLoc, beforeCount || 0, afterCount || 0)
    }
    return createCursorWithCount(cursors.forward, tokens, comments, indexMap, startLoc, endLoc, beforeCount)
}

/**
 * Gets comment tokens that are adjacent to the current cursor position.
 * @param cursor - A cursor instance.
 * @returns An array of comment tokens adjacent to the current cursor position.
 * @private
 */
function getAdjacentCommentTokensFromCursor(cursor: Cursor): Token[] {
    const tokens: Token[] = []
    let currentToken = cursor.getOneToken()

    while (currentToken && isCommentToken(currentToken)) {
        tokens.push(currentToken)
        currentToken = cursor.getOneToken()
    }

    return tokens
}

//------------------------------------------------------------------------------
// Exports
//------------------------------------------------------------------------------

/**
 * The token store.
 *
 * This class provides methods to get tokens by locations as fast as possible.
 * The methods are a part of public API, so we should be careful if it changes this class.
 *
 * People can get tokens in O(1) by the hash map which is mapping from the location of tokens/comments to tokens.
 * Also people can get a mix of tokens and comments in O(log k), the k is the number of comments.
 * Assuming that comments to be much fewer than tokens, this does not make hash map from token's locations to comments to reduce memory cost.
 * This uses binary-searching instead for comments.
 */
export default class TokenStore {
    private _tokens: Token[]
    private _comments: Token[]
    private _indexMap: { [key: number]: number }

    /**
     * Initializes this token store.
     * @param tokens - The array of tokens.
     * @param comments - The array of comments.
     */
    constructor(tokens: Token[], comments: Token[]) {
        this._tokens = tokens
        this._comments = comments
        this._indexMap = createIndexMap(tokens, comments)
    }

    //--------------------------------------------------------------------------
    // Gets single token.
    //--------------------------------------------------------------------------

    /**
     * Gets the token starting at the specified index.
     * @param offset - Index of the start of the token's range.
     * @param options - The option object.
     * @returns The token starting at index, or null if no such token.
     */
    getTokenByRangeStart(offset: number, options?: { includeComments: boolean }): Token | null {
        const includeComments = Boolean(options && options.includeComments)
        const token = cursors.forward.createBaseCursor(
            this._tokens,
            this._comments,
            this._indexMap,
            offset,
            -1,
            includeComments
        ).getOneToken()

        if (token && token.range[0] === offset) {
            return token
        }
        return null
    }

    /**
     * Gets the first token of the given node.
     * @param node - The AST node.
     * @param options - The option object.
     * @returns An object representing the token.
     */
    getFirstToken(node: HasLocation, options?: SkipOptions): Token | null {
        return createCursorWithSkip(
            cursors.forward,
            this._tokens,
            this._comments,
            this._indexMap,
            node.range[0],
            node.range[1],
            options
        ).getOneToken()
    }

    /**
     * Gets the last token of the given node.
     * @param node - The AST node.
     * @param options - The option object.
     * @returns An object representing the token.
     */
    getLastToken(node: HasLocation, options?: SkipOptions): Token | null {
        return createCursorWithSkip(
            cursors.backward,
            this._tokens,
            this._comments,
            this._indexMap,
            node.range[0],
            node.range[1],
            options
        ).getOneToken()
    }

    /**
     * Gets the token that precedes a given node or token.
     * @param node - The AST node or token.
     * @param options - The option object.
     * @returns An object representing the token.
     */
    getTokenBefore(node: HasLocation, options?: SkipOptions): Token | null {
        return createCursorWithSkip(
            cursors.backward,
            this._tokens,
            this._comments,
            this._indexMap,
            -1,
            node.range[0],
            options
        ).getOneToken()
    }

    /**
     * Gets the token that follows a given node or token.
     * @param node - The AST node or token.
     * @param options - The option object.
     * @returns An object representing the token.
     */
    getTokenAfter(node: HasLocation, options?: SkipOptions): Token | null {
        return createCursorWithSkip(
            cursors.forward,
            this._tokens,
            this._comments,
            this._indexMap,
            node.range[1],
            -1,
            options
        ).getOneToken()
    }

    /**
     * Gets the first token between two non-overlapping nodes.
     * @param left - Node before the desired token range.
     * @param right - Node after the desired token range.
     * @param options - The option object.
     * @returns An object representing the token.
     */
    getFirstTokenBetween(left: HasLocation, right: HasLocation, options?: SkipOptions): Token | null {
        return createCursorWithSkip(
            cursors.forward,
            this._tokens,
            this._comments,
            this._indexMap,
            left.range[1],
            right.range[0],
            options
        ).getOneToken()
    }

    /**
     * Gets the last token between two non-overlapping nodes.
     * @param left Node before the desired token range.
     * @param right Node after the desired token range.
     * @param options - The option object.
     * @returns An object representing the token.
     */
    getLastTokenBetween(left: HasLocation, right: HasLocation, options?: SkipOptions): Token | null {
        return createCursorWithSkip(
            cursors.backward,
            this._tokens,
            this._comments,
            this._indexMap,
            left.range[1],
            right.range[0],
            options
        ).getOneToken()
    }

    /**
     * Gets the token that precedes a given node or token in the token stream.
     * This is defined for backward compatibility. Use `includeComments` option instead.
     * TODO: We have a plan to remove this in a future major version.
     * @param node The AST node or token.
     * @param skip A number of tokens to skip.
     * @returns An object representing the token.
     * @deprecated
     */
    getTokenOrCommentBefore(node: HasLocation, skip?: number): Token | null {
        return this.getTokenBefore(node, {includeComments: true, skip})
    }

    /**
     * Gets the token that follows a given node or token in the token stream.
     * This is defined for backward compatibility. Use `includeComments` option instead.
     * TODO: We have a plan to remove this in a future major version.
     * @param node The AST node or token.
     * @param skip A number of tokens to skip.
     * @returns An object representing the token.
     * @deprecated
     */
    getTokenOrCommentAfter(node: HasLocation, skip?: number): Token | null {
        return this.getTokenAfter(node, {includeComments: true, skip})
    }

    //--------------------------------------------------------------------------
    // Gets multiple tokens.
    //--------------------------------------------------------------------------

    /**
     * Gets the first `count` tokens of the given node.
     * @param node - The AST node.
     * @param [options=0] - The option object. If this is a number then it's `options.count`. If this is a function then it's `options.filter`.
     * @param [options.includeComments=false] - The flag to iterate comments as well.
     * @param [options.filter=null] - The predicate function to choose tokens.
     * @param [options.count=0] - The maximum count of tokens the cursor iterates.
     * @returns Tokens.
     */
    getFirstTokens(node: HasLocation, options?: CountOptions): Token[] {
        return createCursorWithCount(
            cursors.forward,
            this._tokens,
            this._comments,
            this._indexMap,
            node.range[0],
            node.range[1],
            options
        ).getAllTokens()
    }

    /**
     * Gets the last `count` tokens of the given node.
     * @param node - The AST node.
     * @param [options=0] - The option object. Same options as getFirstTokens()
     * @returns Tokens.
     */
    getLastTokens(node: HasLocation, options?: CountOptions) {
        return createCursorWithCount(
            cursors.backward,
            this._tokens,
            this._comments,
            this._indexMap,
            node.range[0],
            node.range[1],
            options
        ).getAllTokens().reverse()
    }

    /**
     * Gets the `count` tokens that precedes a given node or token.
     * @param node - The AST node or token.
     * @param [options=0] - The option object. Same options as getFirstTokens()
     * @returns Tokens.
     */
    getTokensBefore(node: HasLocation, options?: CountOptions): Token[] {
        return createCursorWithCount(
            cursors.backward,
            this._tokens,
            this._comments,
            this._indexMap,
            -1,
            node.range[0],
            options
        ).getAllTokens().reverse()
    }

    /**
     * Gets the `count` tokens that follows a given node or token.
     * @param node - The AST node or token.
     * @param [options=0] - The option object. Same options as getFirstTokens()
     * @returns Tokens.
     */
    getTokensAfter(node: HasLocation, options?: CountOptions): Token[] {
        return createCursorWithCount(
            cursors.forward,
            this._tokens,
            this._comments,
            this._indexMap,
            node.range[1],
            -1,
            options
        ).getAllTokens()
    }

    /**
     * Gets the first `count` tokens between two non-overlapping nodes.
     * @param left - Node before the desired token range.
     * @param right - Node after the desired token range.
     * @param [options=0] - The option object. Same options as getFirstTokens()
     * @returns Tokens between left and right.
     */
    getFirstTokensBetween(left: HasLocation, right: HasLocation, options?: CountOptions): Token[] {
        return createCursorWithCount(
            cursors.forward,
            this._tokens,
            this._comments,
            this._indexMap,
            left.range[1],
            right.range[0],
            options
        ).getAllTokens()
    }

    /**
     * Gets the last `count` tokens between two non-overlapping nodes.
     * @param left Node before the desired token range.
     * @param right Node after the desired token range.
     * @param [options=0] - The option object. Same options as getFirstTokens()
     * @returns Tokens between left and right.
     */
    getLastTokensBetween(left: HasLocation, right: HasLocation, options?: CountOptions): Token[] {
        return createCursorWithCount(
            cursors.backward,
            this._tokens,
            this._comments,
            this._indexMap,
            left.range[1],
            right.range[0],
            options
        ).getAllTokens().reverse()
    }

    /**
     * Gets all tokens that are related to the given node.
     * @param node - The AST node.
     * @param beforeCount - The number of tokens before the node to retrieve.
     * @param afterCount - The number of tokens after the node to retrieve.
     * @returns Array of objects representing tokens.
     */
    getTokens(node: HasLocation, beforeCount?: CountOptions, afterCount?: number): Token[] {
        return createCursorWithPadding(
            this._tokens,
            this._comments,
            this._indexMap,
            node.range[0],
            node.range[1],
            beforeCount,
            afterCount
        ).getAllTokens()
    }

    /**
     * Gets all of the tokens between two non-overlapping nodes.
     * @param left Node before the desired token range.
     * @param right Node after the desired token range.
     * @param padding Number of extra tokens on either side of center.
     * @returns Tokens between left and right.
     */
    getTokensBetween(left: HasLocation, right: HasLocation, padding?: CountOptions): Token[] {
        return createCursorWithPadding(
            this._tokens,
            this._comments,
            this._indexMap,
            left.range[1],
            right.range[0],
            padding,
            typeof padding === "number" ? padding : undefined
        ).getAllTokens()
    }

    //--------------------------------------------------------------------------
    // Others.
    //--------------------------------------------------------------------------

    /**
     * Checks whether any comments exist or not between the given 2 nodes.
     *
     * @param left - The node to check.
     * @param right - The node to check.
     * @returns `true` if one or more comments exist.
     */
    commentsExistBetween(left: HasLocation, right: HasLocation): boolean {
        const index = search(this._comments, left.range[1])

        return (
            index < this._comments.length &&
            this._comments[index].range[1] <= right.range[0]
        )
    }

    /**
     * Gets all comment tokens directly before the given node or token.
     * @param nodeOrToken The AST node or token to check for adjacent comment tokens.
     * @returns An array of comments in occurrence order.
     */
    getCommentsBefore(nodeOrToken: HasLocation): Token[] {
        const cursor = createCursorWithCount(
            cursors.backward,
            this._tokens,
            this._comments,
            this._indexMap,
            -1,
            nodeOrToken.range[0],
            {includeComments: true}
        )

        return getAdjacentCommentTokensFromCursor(cursor).reverse()
    }

    /**
     * Gets all comment tokens directly after the given node or token.
     * @param nodeOrToken The AST node or token to check for adjacent comment tokens.
     * @returns An array of comments in occurrence order.
     */
    getCommentsAfter(nodeOrToken: HasLocation): Token[] {
        const cursor = createCursorWithCount(
            cursors.forward,
            this._tokens,
            this._comments,
            this._indexMap,
            nodeOrToken.range[1],
            -1,
            {includeComments: true}
        )

        return getAdjacentCommentTokensFromCursor(cursor)
    }

    /**
     * Gets all comment tokens inside the given node.
     * @param node The AST node to get the comments for.
     * @returns An array of comments in occurrence order.
     */
    getCommentsInside(node: HasLocation): Token[] {
        return this.getTokens(node, {
            includeComments: true,
            filter: isCommentToken,
        })
    }
}
