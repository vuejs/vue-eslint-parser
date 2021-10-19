/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */

export type VisitorKeys = Readonly<{
    [type: string]: readonly string[] | undefined
}>

export declare const KEYS: VisitorKeys
export declare const getKeys: (node: { type: string }) => readonly string[]
export declare const unionWith: (keys: VisitorKeys) => VisitorKeys
