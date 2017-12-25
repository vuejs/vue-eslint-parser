/**
 * @author Toru Nagashima <https://github.com/mysticatea>
 * @copyright 2017 Toru Nagashima. All rights reserved.
 * See LICENSE file in root directory for full license.
 */

export type VisitorKeys = Readonly<{
    [type: string]: ReadonlyArray<string> | undefined
}>

declare const evk: {
    KEYS: VisitorKeys,
    getKeys(node: { type: string }): ReadonlyArray<string>,
    unionWith(keys: VisitorKeys): VisitorKeys
}
export default evk
